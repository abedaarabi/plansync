"use client";

import { AlertTriangle, Check, Circle } from "lucide-react";
import type { BuildingChecklist } from "@/lib/api-client/locations";
import { buildPublishChecklist } from "@/lib/locations/buildingPublish";

type Props = {
  checklist: BuildingChecklist;
};

export function BuildingPublishChecklist({ checklist }: Props) {
  const items = buildPublishChecklist(checklist);

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-2.5">
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
              item.done
                ? "bg-[var(--enterprise-semantic-success-bg)] text-[var(--enterprise-semantic-success-text)]"
                : item.warn
                  ? "bg-[var(--enterprise-semantic-warning-bg)] text-[var(--enterprise-semantic-warning-text)]"
                  : "bg-[var(--enterprise-hover-surface)] text-[var(--enterprise-text-muted)]"
            }`}
          >
            {item.done ? (
              <Check className="h-3 w-3" aria-hidden />
            ) : item.warn ? (
              <AlertTriangle className="h-3 w-3" aria-hidden />
            ) : (
              <Circle className="h-3 w-3" aria-hidden />
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium leading-snug text-[var(--enterprise-text)]">
              {item.label}
            </span>
            {item.detail ? (
              <span className="enterprise-type-caption mt-0.5 block">{item.detail}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
