export type BimLoadPhase =
  | { kind: "resolving" }
  | {
      /** The engine is preparing source data; this is not a network download yet. */
      kind: "preparing";
      label?: string;
      index?: number;
      total?: number;
    }
  | {
      kind: "downloading";
      label?: string;
      index?: number;
      total?: number;
      /** 0–1 progress within the current model (or overall when already aggregated). */
      fraction?: number;
      bytesTotal?: number;
    }
  | {
      kind: "converting";
      fraction: number;
      label?: string;
      index?: number;
      total?: number;
    };

/** Combine per-model 0–1 progress with federation index into an overall 0–1 fraction. */
export function overallLoadFraction(
  index: number | undefined,
  total: number | undefined,
  localFraction: number,
): number {
  const local = Math.min(1, Math.max(0, localFraction));
  if (total != null && total > 1) {
    return Math.min(1, (Math.max(0, index ?? 0) + local) / total);
  }
  return local;
}

/** `fast` = fragments/cache reopen; `convert` = client IFC conversion. */
export type BimLoadPath = "fast" | "convert";

export type BimLoadStepId = "resolve" | "prepare" | "download" | "convert" | "ready";
export type BimLoadStepState = "done" | "active" | "pending";

export type BimLoadStep = {
  id: BimLoadStepId;
  label: string;
  state: BimLoadStepState;
};

const FAST_STEPS: BimLoadStepId[] = ["resolve", "prepare", "download", "ready"];
const CONVERT_STEPS: BimLoadStepId[] = ["resolve", "prepare", "download", "convert", "ready"];

const STEP_LABELS: Record<BimLoadStepId, string> = {
  resolve: "Open",
  prepare: "Prepare",
  download: "Download",
  convert: "Convert",
  ready: "Ready",
};

const CONVERT_TIP_KEY = "plansync-bim-first-convert-tip";

export function stripModelExtension(name: string): string {
  return name.replace(/\.(ifc|ifczip)$/i, "").trim() || name;
}

export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
}

export function buildModelMetaLine(opts: {
  fileName?: string | null;
  version?: string | number | null;
  bytesTotal?: number | null;
  modelIndex?: number | null;
  modelTotal?: number | null;
}): string {
  const parts: string[] = [];
  const lower = (opts.fileName ?? "").toLowerCase();
  if (lower.endsWith(".ifczip")) parts.push("IFCZIP");
  else parts.push("IFC");

  if (opts.version != null && String(opts.version).trim() !== "") {
    parts.push(`v${opts.version}`);
  }

  const size = opts.bytesTotal != null ? formatByteSize(opts.bytesTotal) : "";
  if (size) parts.push(size);

  if (opts.modelTotal != null && opts.modelTotal > 1) {
    parts.push(`${(opts.modelIndex ?? 0) + 1} of ${opts.modelTotal}`);
  }

  return parts.join(" · ");
}

function stepOrder(path: BimLoadPath): BimLoadStepId[] {
  return path === "convert" ? CONVERT_STEPS : FAST_STEPS;
}

function activeStepId(phase: BimLoadPhase, path: BimLoadPath): BimLoadStepId {
  if (phase.kind === "resolving") return "resolve";
  if (phase.kind === "preparing") return "prepare";
  if (phase.kind === "converting") return "convert";
  if (phase.kind === "downloading") return "download";
  // Fallback — converting path without a convert phase still lands on load.
  return path === "convert" ? "download" : "download";
}

export function buildLoadSteps(
  phase: BimLoadPhase,
  opts?: { complete?: boolean; path?: BimLoadPath },
): BimLoadStep[] {
  const path = opts?.path ?? "fast";
  const order = stepOrder(path);
  if (opts?.complete) {
    // Ready only becomes active once load finishes — keep it highlighted through the exit beat.
    return order.map((id) => ({
      id,
      label: STEP_LABELS[id],
      state: id === "ready" ? ("active" as const) : ("done" as const),
    }));
  }
  const active = activeStepId(phase, path);
  const activeIndex = order.indexOf(active);
  return order.map((id, index) => ({
    id,
    label: STEP_LABELS[id],
    state: index < activeIndex ? "done" : index === activeIndex ? "active" : "pending",
  }));
}

/** 0–100 for the active step, or null when indeterminate. */
export function stepProgressPercent(phase: BimLoadPhase): number | null {
  if (phase.kind === "converting") {
    const overall = overallLoadFraction(phase.index, phase.total, phase.fraction);
    return Math.max(4, Math.min(99, Math.round(overall * 100)));
  }
  if (phase.kind === "downloading") {
    if (phase.fraction != null && Number.isFinite(phase.fraction)) {
      const overall = overallLoadFraction(phase.index, phase.total, phase.fraction);
      return Math.max(2, Math.min(99, Math.round(overall * 100)));
    }
    if (phase.total != null && phase.total > 1) {
      const done = phase.index ?? 0;
      return Math.max(4, Math.min(96, Math.round(((done + 0.35) / phase.total) * 100)));
    }
    return null;
  }
  return null;
}

function modelOrdinal(index?: number, total?: number): string | null {
  if (total == null || total <= 1) return null;
  return ` ${(index ?? 0) + 1} of ${total}`;
}

export function phaseHeadline(phase: BimLoadPhase, path: BimLoadPath = "fast"): string {
  if (phase.kind === "resolving") return "Opening 3D workspace";
  if (phase.kind === "preparing") {
    return `Preparing model${modelOrdinal(phase.index, phase.total) ?? ""}`;
  }
  if (phase.kind === "converting") {
    return `Converting model${modelOrdinal(phase.index, phase.total) ?? ""}`;
  }
  const ordinal = modelOrdinal(phase.index, phase.total) ?? "";
  return path === "convert" ? `Downloading model${ordinal}` : `Loading model${ordinal}`;
}

/** Headline while the overlay is finishing / Ready is active. */
export function completeHeadline(): string {
  return "Ready";
}

export function shouldShowFirstConvertTip(): boolean {
  try {
    return localStorage.getItem(CONVERT_TIP_KEY) !== "1";
  } catch {
    return true;
  }
}

export function markFirstConvertTipSeen(): void {
  try {
    localStorage.setItem(CONVERT_TIP_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function phaseModelLabel(phase: BimLoadPhase, fallback?: string | null): string | null {
  const raw = phase.kind === "resolving" ? (fallback ?? null) : (phase.label ?? fallback ?? null);
  if (!raw) return null;
  return stripModelExtension(raw);
}
