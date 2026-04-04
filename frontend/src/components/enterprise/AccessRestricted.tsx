"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

export function AccessRestricted({ backHref = "/projects" }: { backHref?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-16">
      <div className="enterprise-card max-w-md p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <Lock className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </div>
        <h1 className="text-lg font-semibold text-[var(--enterprise-text)]">Access restricted</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
          You don&apos;t have permission to view this section. Contact your project admin if you
          need access.
        </p>
        <Link
          href={backHref}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-[var(--enterprise-primary)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          ← Go back
        </Link>
      </div>
    </div>
  );
}
