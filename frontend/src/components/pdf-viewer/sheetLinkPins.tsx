"use client";

import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_STATUS_LABEL,
  issuePriorityPinAccent,
  issueStatusDotSolidFill,
  issueAssigneeShortLabel,
} from "@/lib/issueStatusStyle";

type PinBaseProps = {
  cx: number;
  cy: number;
  cssW: number;
  cssH: number;
  pinShadowFilterUrl: string;
  selected?: boolean;
};

function pinScale(cssW: number, cssH: number): number {
  const m = Math.min(cssW, cssH);
  return Math.max(0.85, Math.min(1.35, m / 920));
}

/** Status-colored dot at the map pin tip. */
function StatusTipDot({
  cx,
  cy,
  r,
  status,
}: {
  cx: number;
  cy: number;
  r: number;
  status: string;
}) {
  const fill = issueStatusDotSolidFill(status);
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      stroke="rgba(15,23,42,0.35)"
      strokeWidth={Math.max(0.4, r * 0.12)}
    />
  );
}

function FieldwireIssueCard({
  cx,
  topY,
  s,
  initials,
  numLabel,
  priority,
  status,
  pinShadowFilterUrl,
  workOrder,
  hasAttachments,
}: {
  cx: number;
  topY: number;
  s: number;
  initials: string;
  numLabel: string;
  priority: string;
  status: string;
  pinShadowFilterUrl: string;
  workOrder?: boolean;
  /** Reference photos, linked sheet markups, or RFIs on this issue. */
  hasAttachments?: boolean;
}) {
  const w = 56 * s;
  const h = 40 * s;
  const x = cx - w / 2;
  const y = topY;
  const r = 7 * s;
  const accent = issuePriorityPinAccent(priority);
  const fs1 = 8.5 * s;
  const fs2 = 9.5 * s;
  return (
    <g filter={pinShadowFilterUrl}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={r}
        fill="#ffffff"
        stroke={accent}
        strokeWidth={Math.max(1, 1.25 * s)}
      />
      {workOrder ? (
        <text
          x={x + w - 5 * s}
          y={y + 8 * s}
          textAnchor="end"
          fontSize={6.5 * s}
          fontWeight={700}
          fill="#64748b"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          WO
        </text>
      ) : null}
      {hasAttachments ? (
        <g>
          <circle
            cx={x + 9 * s}
            cy={y + 9 * s}
            r={7.25 * s}
            fill="#fff7ed"
            stroke="#ea580c"
            strokeWidth={Math.max(0.65, 0.85 * s)}
          />
          <text
            x={x + 9 * s}
            y={y + 10.25 * s}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={7.5 * s}
            style={{
              fontFamily:
                "system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif",
            }}
          >
            📎
          </text>
        </g>
      ) : null}
      <text
        x={cx}
        y={y + 17 * s}
        textAnchor="middle"
        fontSize={fs1}
        fontWeight={700}
        fill="#0f172a"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        {initials}
      </text>
      <text
        x={cx}
        y={y + 31.5 * s}
        textAnchor="middle"
        fontSize={fs2}
        fontWeight={600}
        fill="#475569"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        {numLabel}
      </text>
    </g>
  );
}

function PinStemAndTip({
  cx,
  y0,
  y1,
  s,
  status,
}: {
  cx: number;
  y0: number;
  y1: number;
  s: number;
  status: string;
}) {
  const tipR = 5.2 * s;
  return (
    <g>
      <line
        x1={cx}
        y1={y0}
        x2={cx}
        y2={y1 - tipR * 1.05}
        stroke="rgba(51,65,85,0.55)"
        strokeWidth={Math.max(1, 1.35 * s)}
        strokeLinecap="round"
      />
      <StatusTipDot cx={cx} cy={y1} r={tipR} status={status} />
    </g>
  );
}

/** Construction / coordination issue — Fieldwire-style card + stem + status tip. */
export function ConstructionIssuePin({
  cx,
  cy,
  status,
  priority,
  initials,
  numLabel,
  cssW,
  cssH,
  pinShadowFilterUrl,
  selected,
  hasAttachments,
}: PinBaseProps & {
  status: string;
  priority: string;
  initials: string;
  numLabel: string;
  hasAttachments?: boolean;
}) {
  const s = pinScale(cssW, cssH);
  const cardTop = cy - 54 * s;
  const stemTop = cardTop + 40 * s;
  const tipY = cy + 4 * s;
  return (
    <g className={selected ? "issue-pin-selected" : undefined}>
      {selected ? (
        <circle
          cx={cx}
          cy={cy - 8 * s}
          r={34 * s}
          fill="none"
          stroke="#2563eb"
          strokeWidth={2 * s}
          opacity={0.85}
        >
          <animate
            attributeName="opacity"
            values="0.35;0.95;0.35"
            dur="1.4s"
            repeatCount="indefinite"
          />
        </circle>
      ) : null}
      <FieldwireIssueCard
        cx={cx}
        topY={cardTop}
        s={s}
        initials={initials}
        numLabel={numLabel}
        priority={priority}
        status={status}
        pinShadowFilterUrl={pinShadowFilterUrl}
        hasAttachments={hasAttachments}
      />
      <PinStemAndTip cx={cx} y0={stemTop} y1={tipY} s={s} status={status} />
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

/** Operations work order — same card treatment with WO hint; flat hex behind tip optional — keep stem. */
export function WorkOrderIssuePin({
  cx,
  cy,
  status,
  priority,
  initials,
  numLabel,
  cssW,
  cssH,
  pinShadowFilterUrl,
  selected,
  hasAttachments,
}: PinBaseProps & {
  status: string;
  priority: string;
  initials: string;
  numLabel: string;
  hasAttachments?: boolean;
}) {
  const s = pinScale(cssW, cssH);
  const cardTop = cy - 54 * s;
  const stemTop = cardTop + 40 * s;
  const tipY = cy + 4 * s;
  return (
    <g className={selected ? "issue-pin-selected" : undefined}>
      {selected ? (
        <path
          d={flatTopHexPath(cx, cy - 8 * s, 30 * s)}
          fill="none"
          stroke="#2563eb"
          strokeWidth={2 * s}
          opacity={0.85}
        >
          <animate
            attributeName="opacity"
            values="0.35;0.95;0.35"
            dur="1.4s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}
      <FieldwireIssueCard
        cx={cx}
        topY={cardTop}
        s={s}
        initials={initials}
        numLabel={numLabel}
        priority={priority}
        status={status}
        pinShadowFilterUrl={pinShadowFilterUrl}
        workOrder
        hasAttachments={hasAttachments}
      />
      <PinStemAndTip cx={cx} y0={stemTop} y1={tipY} s={s} status={status} />
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
  const s = (pinScale(cssW, cssH) * 14) / 11;
  const fill = "#0d9488";
  const stroke = "rgba(15,23,42,0.28)";
  const label = truncatePinLabel(title, 36);
  const fs = Math.max(9, Math.min(13, 6 + s * 0.55));
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
  selected,
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
    linkedIssueTitle?: string;
    linkedIssuePriority?: string;
    linkedIssueAssigneeInitials?: string;
    linkedIssueDisplayNum?: number;
    linkedIssueHasAttachments?: boolean;
    author?: string;
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
  const priority = a.linkedIssuePriority ?? "MEDIUM";
  const initials = truncatePinLabel(
    (a.linkedIssueAssigneeInitials ?? "").trim() || issueAssigneeShortLabel(a.author, undefined),
    15,
  );
  const numLabel =
    a.linkedIssueDisplayNum != null && Number.isFinite(a.linkedIssueDisplayNum)
      ? `#${a.linkedIssueDisplayNum}`
      : a.issueDraft
        ? "NEW"
        : "#—";
  const title =
    (a.linkedIssueTitle ?? "").trim() || (a.issueDraft ? "New issue (unsaved)" : "Linked issue");
  const priLabel = ISSUE_PRIORITY_LABEL[priority] ?? priority;
  const stLabel = ISSUE_STATUS_LABEL[status] ?? status.replace(/_/g, " ");
  const sub = `${initials} · ${priLabel} · ${stLabel}`;
  const hasAttachments = Boolean(a.linkedIssueHasAttachments);

  const common = (
    <title>{`${numLabel} ${title}\n${sub}${hasAttachments ? "\nHas attachments" : ""}`}</title>
  );

  if (kind === "WORK_ORDER") {
    return (
      <g>
        {common}
        <WorkOrderIssuePin
          cx={cx}
          cy={cy}
          status={status}
          priority={priority}
          initials={initials}
          numLabel={numLabel}
          cssW={cssW}
          cssH={cssH}
          pinShadowFilterUrl={pinShadowFilterUrl}
          selected={selected}
          hasAttachments={hasAttachments}
        />
      </g>
    );
  }

  return (
    <g>
      {common}
      <ConstructionIssuePin
        cx={cx}
        cy={cy}
        status={status}
        priority={priority}
        initials={initials}
        numLabel={numLabel}
        cssW={cssW}
        cssH={cssH}
        pinShadowFilterUrl={pinShadowFilterUrl}
        selected={selected}
        hasAttachments={hasAttachments}
      />
    </g>
  );
}
