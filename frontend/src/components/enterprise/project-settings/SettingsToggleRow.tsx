"use client";

type Props = {
  label: string;
  description?: string;
  on: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
};

export function SettingsToggleRow({ label, description, on, onToggle, disabled }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--enterprise-text)]">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1 sm:self-center">
        <span
          className={
            on
              ? "text-xs font-semibold text-[var(--enterprise-primary)]"
              : "text-xs font-medium text-[var(--enterprise-text-muted)]"
          }
        >
          {on ? "On" : "Off"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={`${label} toggle`}
          disabled={disabled}
          onClick={() => onToggle(!on)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition ${
            on
              ? "border-[var(--enterprise-primary)] bg-[var(--enterprise-primary)]"
              : "border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
              on ? "translate-x-5" : "translate-x-1"
            }`}
            aria-hidden
          />
        </button>
      </div>
    </div>
  );
}
