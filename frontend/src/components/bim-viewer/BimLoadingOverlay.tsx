"use client";

import Image from "next/image";

type Phase =
  | { kind: "resolving" }
  | { kind: "downloading"; label?: string; index?: number; total?: number }
  | { kind: "converting"; fraction: number; label?: string };

// fallow-ignore-next-line complexity
function phaseTitle(phase: Phase): string {
  if (phase.kind === "resolving") return "Preparing your model";
  if (phase.kind === "converting") {
    return `Converting ${phase.label ?? "model"}`;
  }
  if (phase.total != null && phase.total > 1) {
    return `Loading ${phase.label ?? "model"}`;
  }
  return `Opening ${phase.label ?? "model"}`;
}

// fallow-ignore-next-line complexity
function phaseDetail(phase: Phase): string {
  if (phase.kind === "resolving") {
    return "Setting up the 3D workspace…";
  }
  if (phase.kind === "converting") {
    return "Building a fast view for next time — this can take a moment on first open.";
  }
  if (phase.total != null && phase.total > 1) {
    return `Model ${(phase.index ?? 0) + 1} of ${phase.total}`;
  }
  return "Downloading geometry and preparing the viewport…";
}

export function BimLoadingOverlay({ phase }: { phase: Phase }) {
  const progress =
    phase.kind === "converting" ? Math.max(4, Math.round(phase.fraction * 100)) : null;

  return (
    <div
      className="bim-loading-overlay absolute inset-0 z-10 flex flex-col items-center justify-center px-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={phaseTitle(phase)}
    >
      <div className="bim-loading-card enterprise-animate-in flex w-full max-w-[22rem] flex-col items-center px-8 py-9 text-center">
        <div className="bim-loading-logo relative flex h-[4.5rem] w-[4.5rem] items-center justify-center">
          <span className="bim-loading-logo__ring" aria-hidden />
          <span className="bim-loading-logo__glow" aria-hidden />
          <Image
            src="/logo.svg"
            alt=""
            width={40}
            height={40}
            className="relative"
            style={{ width: 40, height: 40 }}
            priority
          />
        </div>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--bim-text-subtle)]">
          <span className="text-[var(--bim-text)]">Plan</span>
          <span className="text-[var(--bim-accent)]">Sync</span>
        </p>

        <p className="mt-3 text-[15px] font-semibold tracking-tight text-[var(--bim-text)]">
          {phaseTitle(phase)}
        </p>
        <p className="mt-1.5 max-w-[18rem] text-[12px] leading-relaxed text-[var(--bim-text-muted)]">
          {phaseDetail(phase)}
        </p>

        <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-[var(--bim-border)]">
          {progress != null ? (
            <div
              className="h-full rounded-full bg-[var(--bim-accent)] transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          ) : (
            <div className="bim-loading-bar h-full w-[42%] rounded-full bg-gradient-to-r from-[var(--bim-accent)] to-[#60a5fa]" />
          )}
        </div>

        {progress != null ? (
          <p className="mt-2 text-[11px] tabular-nums text-[var(--bim-text-muted)]">{progress}%</p>
        ) : null}
      </div>
    </div>
  );
}
