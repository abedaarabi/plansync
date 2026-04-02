"use client";

import { PROJECT_CURRENCIES, type ProjectCurrencyCode } from "@/lib/projectCurrency";

type Props = {
  value: ProjectCurrencyCode;
  onChange: (code: ProjectCurrencyCode) => void;
  idPrefix?: string;
  disabled?: boolean;
};

export function ProjectCurrencyPicker({ value, onChange, idPrefix = "currency", disabled }: Props) {
  const popular = PROJECT_CURRENCIES.filter((c) => c.popular);
  const allSorted = [...PROJECT_CURRENCIES].sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {popular.map((c) => {
          const selected = value === c.code;
          return (
            <button
              key={c.code}
              type="button"
              disabled={disabled}
              id={`${idPrefix}-${c.code}`}
              onClick={() => onChange(c.code)}
              className={`flex flex-col items-start rounded-xl border px-3 py-2.5 text-left transition ${
                selected
                  ? "border-[var(--enterprise-primary)] bg-[var(--enterprise-primary)]/10 text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] ring-2 ring-[var(--enterprise-primary)]/25"
                  : "border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text)] hover:border-[var(--enterprise-primary)]/40 hover:bg-[var(--enterprise-hover-surface)]"
              } ${disabled ? "opacity-60" : ""}`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--enterprise-text-muted)]">
                {c.code}
              </span>
              <span className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-lg font-semibold tabular-nums text-[var(--enterprise-text)]">
                  {c.symbol}
                </span>
                <span className="line-clamp-1 text-[11px] text-[var(--enterprise-text-muted)]">
                  {c.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div>
        <label htmlFor={`${idPrefix}-select`} className="sr-only">
          All currencies
        </label>
        <select
          id={`${idPrefix}-select`}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value as ProjectCurrencyCode)}
          className="mt-1.5 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
        >
          {allSorted.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-[var(--enterprise-text-muted)]">
          Budget, material rates, and cost columns use this currency.
        </p>
      </div>
    </div>
  );
}
