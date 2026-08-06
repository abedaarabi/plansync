"use client";

import { CircleDot } from "lucide-react";
import type { PunchRow } from "@/lib/api-client";
import { PUNCH_STATUS_LABEL } from "@/lib/issueStatusStyle";
import { MOBILE_FORM_SECTION } from "@/lib/mobileFormStyles";
import { formatOmWhen } from "@/lib/formatOmWhen";

type Props = {
  punch: PunchRow;
};

export function PunchActivityTimeline({ punch }: Props) {
  const events = [
    { key: "created", label: "Created", at: punch.createdAt },
    ...(punch.updatedAt !== punch.createdAt
      ? [
          {
            key: "updated",
            label: `Status → ${PUNCH_STATUS_LABEL[punch.status] ?? punch.status}`,
            at: punch.updatedAt,
          },
        ]
      : []),
    ...(punch.completedAt ? [{ key: "completed", label: "Completed", at: punch.completedAt }] : []),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className={MOBILE_FORM_SECTION}>
      <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Activity</p>
      <ol className="space-y-2.5">
        {events.map((ev) => (
          <li key={ev.key} className="flex gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)]"
              aria-hidden
            >
              <CircleDot className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-semibold text-[var(--enterprise-text)]">{ev.label}</p>
              <p className="text-[11px] text-[var(--enterprise-text-muted)]">
                {formatOmWhen(ev.at)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
