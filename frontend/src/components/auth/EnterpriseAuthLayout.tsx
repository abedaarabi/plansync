import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

export function EnterpriseAuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--enterprise-auth-bg)] font-[family-name:var(--font-inter)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 85% 55% at 50% -25%, rgba(59, 130, 246, 0.22), transparent 55%), radial-gradient(ellipse 100% 60% at 100% 100%, rgba(15, 23, 42, 0.35), transparent)",
        }}
        aria-hidden
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex flex-col items-center text-center">
            <Link
              href="/"
              className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-md shadow-slate-900/20 ring-1 ring-white/20 transition hover:shadow-lg hover:ring-white/30"
            >
              <Image
                src="/logo.svg"
                alt="PlanSync"
                width={40}
                height={40}
                className="h-10 w-10"
                priority
              />
            </Link>
            <h1 className="text-2xl font-bold text-white" style={{ fontSize: "24px" }}>
              {title}
            </h1>
            {description ? (
              <div className="mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
                {description}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200/12 bg-white/98 p-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)] ring-1 ring-white/10 sm:p-8">
            {children}
          </div>

          <nav className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center text-sm text-slate-500">
            <Link href="/" className="transition hover:text-slate-300">
              ← Home
            </Link>
            <span className="text-slate-600" aria-hidden>
              ·
            </span>
            <Link href="/sign-in" className="transition hover:text-slate-300">
              Sign in
            </Link>
            <span className="text-slate-600" aria-hidden>
              ·
            </span>
            <Link href="/viewer" className="transition hover:text-slate-300">
              Free local viewer
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}
