"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { buildThumbnailCacheKey, readCachedThumbnail } from "@/lib/bim/bimThumbnailCache";
import {
  buildLoadSteps,
  buildModelMetaLine,
  markFirstConvertTipSeen,
  phaseHeadline,
  phaseModelLabel,
  shouldShowFirstConvertTip,
  stepProgressPercent,
  type BimLoadPhase,
} from "@/lib/bim/bimLoadingSteps";

export type { BimLoadPhase };

function useCachedModelThumbnail(fileVersionId?: string | null) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!fileVersionId) {
      setThumbnailUrl(null);
      return;
    }
    let cancelled = false;
    void readCachedThumbnail(buildThumbnailCacheKey(fileVersionId)).then((url) => {
      if (!cancelled) setThumbnailUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [fileVersionId]);

  return thumbnailUrl;
}

function BimLoadingBrandMark() {
  return (
    <div className="bim-loading-brand-mark">
      <Image
        src="/logo.svg"
        alt=""
        width={28}
        height={28}
        className="bim-loading-brand-mark__logo"
        style={{ width: 28, height: 28 }}
        priority
      />
      <div className="bim-loading-brand-mark__text">
        <span>
          <span className="text-[var(--bim-text)]">Plan</span>
          <span className="text-[var(--bim-accent)]">Sync</span>
        </span>
        <span className="bim-loading-brand-mark__sub">3D Engine</span>
      </div>
    </div>
  );
}

function BimLoadingSteps({ phase, complete }: { phase: BimLoadPhase; complete?: boolean }) {
  const steps = buildLoadSteps(phase, { complete });
  return (
    <ol className="bim-loading-steps">
      {steps.map((step) => (
        <li key={step.id} className="bim-loading-steps__item" data-state={step.state}>
          <span className="bim-loading-steps__dot" aria-hidden>
            {step.state === "done" ? <Check className="h-3 w-3" strokeWidth={2.5} /> : null}
          </span>
          <span className="bim-loading-steps__label">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

function BimLoadingProgress({ phase }: { phase: BimLoadPhase }) {
  const percent = stepProgressPercent(phase);
  return (
    <div className="bim-loading-progress">
      <div className="bim-loading-progress__track">
        {percent != null ? (
          <div className="bim-loading-progress__fill" style={{ width: `${percent}%` }} />
        ) : (
          <div className="bim-loading-bar bim-loading-progress__fill bim-loading-progress__fill--indeterminate" />
        )}
      </div>
      {percent != null ? (
        <p className="bim-loading-progress__pct tabular-nums">{percent}%</p>
      ) : null}
    </div>
  );
}

function useFirstConvertTip(phase: BimLoadPhase) {
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    if (phase.kind !== "converting") return;
    if (!shouldShowFirstConvertTip()) return;
    setShowTip(true);
    markFirstConvertTipSeen();
  }, [phase.kind]);

  return showTip && phase.kind === "converting";
}

type LoadingShellProps = {
  phase: BimLoadPhase;
  fileVersionId?: string | null;
  modelName?: string | null;
  version?: string | number | null;
  exiting?: boolean;
  className?: string;
};

// fallow-ignore-next-line complexity
function BimLoadingShell(props: LoadingShellProps) {
  const { phase, fileVersionId, modelName, version, exiting, className } = props;
  const thumbnailUrl = useCachedModelThumbnail(fileVersionId);
  const displayName = phaseModelLabel(phase, modelName);
  const rawName = phase.kind === "resolving" ? modelName : (phase.label ?? modelName ?? null);
  const bytesTotal = phase.kind === "downloading" ? (phase.bytesTotal ?? null) : null;
  const modelIndex = phase.kind === "downloading" ? (phase.index ?? null) : null;
  const modelTotal = phase.kind === "downloading" ? (phase.total ?? null) : null;
  const meta = buildModelMetaLine({
    fileName: rawName ?? modelName,
    version,
    bytesTotal,
    modelIndex,
    modelTotal,
  });
  const headline = phaseHeadline(phase);
  const showTip = useFirstConvertTip(phase);

  return (
    <div
      className={`bim-loading-overlay ${className ?? ""}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy={!exiting}
      aria-label={headline}
      data-exiting={exiting ? "true" : undefined}
    >
      <div className="bim-loading-topbar">
        <BimLoadingBrandMark />
      </div>

      <div className="bim-loading-stage enterprise-animate-in">
        {thumbnailUrl ? (
          <div className="bim-loading-preview" aria-hidden>
            <img src={thumbnailUrl} alt="" className="bim-loading-preview__img" />
          </div>
        ) : (
          <div className="bim-loading-preview bim-loading-preview--empty" aria-hidden />
        )}

        {displayName ? (
          <h1 className="bim-loading-model-name" title={rawName ?? displayName}>
            {displayName}
          </h1>
        ) : null}
        <p className="bim-loading-meta">{meta}</p>
        <p className="bim-loading-headline">{headline}</p>

        <BimLoadingSteps phase={phase} complete={exiting} />
        <BimLoadingProgress phase={exiting ? { kind: "converting", fraction: 1 } : phase} />

        {showTip ? (
          <p className="bim-loading-tip">
            First conversion may take a minute — later opens are much faster.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function BimBootLoading({
  modelName,
  fileVersionId,
  version,
}: {
  message?: string;
  modelName?: string | null;
  fileVersionId?: string | null;
  version?: string | number | null;
}) {
  return (
    <div className="bim-viewer relative h-dvh w-full">
      <BimLoadingShell
        phase={{ kind: "resolving" }}
        modelName={modelName}
        fileVersionId={fileVersionId}
        version={version}
        className="absolute inset-0"
      />
    </div>
  );
}

/** Boot shell that reads model / project from the viewer URL. */
export function BimBootLoadingFromUrl() {
  const searchParams = useSearchParams();
  const name = searchParams.get("name");

  return (
    <BimBootLoading
      modelName={name ? decodeURIComponent(name) : null}
      fileVersionId={searchParams.get("fileVersionId")}
      version={searchParams.get("version")}
    />
  );
}

export function BimLoadingOverlay({
  phase,
  fileVersionId,
  modelName,
  version,
  exiting,
}: {
  phase: BimLoadPhase;
  fileVersionId?: string | null;
  modelName?: string | null;
  version?: string | number | null;
  exiting?: boolean;
}) {
  return (
    <BimLoadingShell
      phase={phase}
      fileVersionId={fileVersionId}
      modelName={modelName}
      version={version}
      exiting={exiting}
      className="absolute inset-0 z-10"
    />
  );
}
