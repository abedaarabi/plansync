import type { ReactNode } from "react";

export function OmFormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
