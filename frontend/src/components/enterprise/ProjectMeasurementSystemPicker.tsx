"use client";

import { Ruler, Scaling } from "lucide-react";
import {
  PROJECT_MEASUREMENT_SYSTEMS,
  type ProjectMeasurementSystem,
} from "@/lib/projectMeasurement";

type Props = {
  value: ProjectMeasurementSystem;
  onChange: (v: ProjectMeasurementSystem) => void;
  disabled?: boolean;
};

export function ProjectMeasurementSystemPicker({ value, onChange, disabled }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {PROJECT_MEASUREMENT_SYSTEMS.map((opt) => {
        const selected = value === opt.value;
        const Icon = opt.value === "METRIC" ? Ruler : Scaling;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`flex gap-3 rounded-xl border px-4 py-3 text-left transition ${
              selected
                ? "border-[var(--enterprise-primary)] bg-[var(--enterprise-primary)]/10 ring-2 ring-[var(--enterprise-primary)]/25"
                : "border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] hover:border-[var(--enterprise-primary)]/35 hover:bg-[var(--enterprise-hover-surface)]"
            } ${disabled ? "opacity-60" : ""}`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                selected
                  ? "border-[var(--enterprise-primary)]/40 bg-[var(--enterprise-primary)]/15 text-[var(--enterprise-primary)]"
                  : "border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 text-[var(--enterprise-text-muted)]"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--enterprise-text)]">{opt.title}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-[var(--enterprise-text-muted)]">
                {opt.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
