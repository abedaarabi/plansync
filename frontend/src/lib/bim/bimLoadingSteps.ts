export type BimLoadPhase =
  | { kind: "resolving" }
  | {
      kind: "downloading";
      label?: string;
      index?: number;
      total?: number;
      fraction?: number;
      bytesTotal?: number;
    }
  | { kind: "converting"; fraction: number; label?: string };

export type BimLoadStepId = "resolve" | "download" | "convert" | "ready";
export type BimLoadStepState = "done" | "active" | "pending";

export type BimLoadStep = {
  id: BimLoadStepId;
  label: string;
  state: BimLoadStepState;
};

const STEP_ORDER: BimLoadStepId[] = ["resolve", "download", "convert", "ready"];

const STEP_LABELS: Record<BimLoadStepId, string> = {
  resolve: "Resolve",
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

function activeStepId(phase: BimLoadPhase): BimLoadStepId {
  if (phase.kind === "resolving") return "resolve";
  if (phase.kind === "downloading") return "download";
  return "convert";
}

export function buildLoadSteps(phase: BimLoadPhase, opts?: { complete?: boolean }): BimLoadStep[] {
  if (opts?.complete) {
    return STEP_ORDER.map((id) => ({
      id,
      label: STEP_LABELS[id],
      state: "done" as const,
    }));
  }
  const active = activeStepId(phase);
  const activeIndex = STEP_ORDER.indexOf(active);
  return STEP_ORDER.map((id, index) => ({
    id,
    label: STEP_LABELS[id],
    state: index < activeIndex ? "done" : index === activeIndex ? "active" : "pending",
  }));
}

/** 0–100 for the active step, or null when indeterminate. */
export function stepProgressPercent(phase: BimLoadPhase): number | null {
  if (phase.kind === "converting") {
    return Math.max(4, Math.min(100, Math.round(phase.fraction * 100)));
  }
  if (phase.kind === "downloading") {
    if (phase.fraction != null && Number.isFinite(phase.fraction)) {
      return Math.max(2, Math.min(99, Math.round(phase.fraction * 100)));
    }
    if (phase.total != null && phase.total > 1) {
      const done = phase.index ?? 0;
      return Math.max(4, Math.min(96, Math.round(((done + 0.35) / phase.total) * 100)));
    }
    return null;
  }
  return null;
}

export function phaseHeadline(phase: BimLoadPhase): string {
  if (phase.kind === "resolving") return "Preparing workspace";
  if (phase.kind === "converting") return "Converting model";
  if (phase.total != null && phase.total > 1) {
    return `Downloading model ${(phase.index ?? 0) + 1} of ${phase.total}`;
  }
  return "Downloading model";
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
