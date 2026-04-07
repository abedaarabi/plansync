"use client";

import { issueStatusDotRadii, issueStatusDotSolidFill } from "@/lib/issueStatusStyle";

type PinBaseProps = {
  cx: number;
  cy: number;
  cssW: number;
  cssH: number;
  pinShadowFilterUrl: string;
};

/** Construction / coordination issue — status-colored circle + soft ring (classic pin). */
export function ConstructionIssuePin({
  cx,
  cy,
  status,
  cssW,
  cssH,
  pinShadowFilterUrl,
}: PinBaseProps & { status: string }) {
  const { core, halo } = issueStatusDotRadii(cssW, cssH);
  const fill = issueStatusDotSolidFill(status);
  const sw = Math.max(0.55, core * 0.12);
  const ringW = Math.max(1, halo - core);
  const ringR = (core + halo) / 2;
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={ringR}
        fill="none"
        stroke="rgba(15,23,42,0.32)"
        strokeWidth={ringW}
      />
      <circle
        cx={cx}
        cy={cy}
        r={core}
        fill={fill}
        stroke="rgba(15,23,42,0.32)"
        strokeWidth={sw}
        filter={pinShadowFilterUrl}
      />
    </g>
  );
}

function flatTopHexPath(cx: number, cy: number, R: number): string {
  const parts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = ((-30 + i * 60) * Math.PI) / 180;
    const x = cx + R * Math.cos(ang);
    const y = cy + R * Math.sin(ang);
    parts.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
  }
  return `${parts.join(" ")} Z`;
}

/** Operations work order — flat-top hexagon (distinct from round construction pins). */
export function WorkOrderIssuePin({
  cx,
  cy,
  status,
  cssW,
  cssH,
  pinShadowFilterUrl,
}: PinBaseProps & { status: string }) {
  const { core, halo } = issueStatusDotRadii(cssW, cssH);
  const fill = issueStatusDotSolidFill(status);
  const ringR = (core + halo) / 2;
  const ringW = Math.max(1, halo - core);
  const R = core;
  const sw = Math.max(0.5, core * 0.1);
  return (
    <g>
      <path
        d={flatTopHexPath(cx, cy, ringR)}
        fill="none"
        stroke="rgba(15,23,42,0.32)"
        strokeWidth={ringW}
        strokeLinejoin="round"
      />
      <path
        d={flatTopHexPath(cx, cy, R)}
        fill={fill}
        stroke="rgba(15,23,42,0.32)"
        strokeWidth={sw}
        strokeLinejoin="round"
        filter={pinShadowFilterUrl}
      />
    </g>
  );
}

function truncatePinLabel(raw: string, maxLen: number): string {
  const t = raw.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1).trimEnd()}…`;
}

/** O&M asset location — map-marker silhouette + asset title under the tip. */
export function AssetLocationPin({
  cx,
  cy,
  cssW,
  cssH,
  pinShadowFilterUrl,
  title,
}: PinBaseProps & { title: string }) {
  const { core } = issueStatusDotRadii(cssW, cssH);
  const s = (core * 2.35) / 14;
  const fill = "#0d9488";
  const stroke = "rgba(15,23,42,0.28)";
  const label = truncatePinLabel(title, 36);
  const fs = Math.max(9, Math.min(13, 6 + core * 0.55));
  const tipY = cy + 10.5 * s;
  const labelY = tipY + fs * 0.65;
  return (
    <g>
      <g filter={pinShadowFilterUrl}>
        <g transform={`translate(${cx - 12 * s}, ${cy - 10.5 * s}) scale(${s})`}>
          <path
            d="M12 2.25C8.05 2.25 4.75 5.55 4.75 9.55c0 4.35 5.65 10.85 6.95 12.35.35.4.9.4 1.25 0 1.3-1.5 7.05-8 7.05-12.35 0-4-3.3-7.3-7.25-7.3z"
            fill={fill}
            stroke={stroke}
            strokeWidth={1.15}
            strokeLinejoin="round"
          />
          <circle cx="12" cy="9.2" r="2.85" fill="rgba(255,255,255,0.92)" />
        </g>
      </g>
      <text
        x={cx}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="hanging"
        fontSize={fs}
        fontWeight={600}
        fill="#0f172a"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth={Math.max(0.35, fs * 0.045)}
        paintOrder="stroke fill"
        style={{ fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}
      >
        {label}
      </text>
    </g>
  );
}

export function SheetLinkPin({
  annotation: a,
  cx,
  cy,
  cssW,
  cssH,
  pinShadowFilterUrl,
}: PinBaseProps & {
  annotation: {
    linkedOmAssetId?: string;
    omAssetDraft?: boolean;
    linkedOmAssetName?: string;
    linkedOmAssetTag?: string;
    linkedIssueId?: string;
    issueDraft?: boolean;
    linkedIssueKind?: "WORK_ORDER" | "CONSTRUCTION";
    issueStatus?: string;
  };
}) {
  if (a.linkedOmAssetId || a.omAssetDraft) {
    const assetTitle = a.linkedOmAssetName?.trim() || a.linkedOmAssetTag?.trim() || "Equipment";
    return (
      <AssetLocationPin
        cx={cx}
        cy={cy}
        cssW={cssW}
        cssH={cssH}
        pinShadowFilterUrl={pinShadowFilterUrl}
        title={assetTitle}
      />
    );
  }

  const status = a.issueStatus ?? "OPEN";
  const kind = a.linkedIssueKind === "WORK_ORDER" ? "WORK_ORDER" : "CONSTRUCTION";

  if (kind === "WORK_ORDER") {
    return (
      <WorkOrderIssuePin
        cx={cx}
        cy={cy}
        status={status}
        cssW={cssW}
        cssH={cssH}
        pinShadowFilterUrl={pinShadowFilterUrl}
      />
    );
  }

  return (
    <ConstructionIssuePin
      cx={cx}
      cy={cy}
      status={status}
      cssW={cssW}
      cssH={cssH}
      pinShadowFilterUrl={pinShadowFilterUrl}
    />
  );
}
