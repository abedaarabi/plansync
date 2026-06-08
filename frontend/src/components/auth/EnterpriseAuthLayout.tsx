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
    <div className="relative flex min-h-[100dvh] w-full flex-1 flex-col overflow-hidden bg-[var(--enterprise-auth-bg)] pb-[env(safe-area-inset-bottom,0px)] pt-[env(safe-area-inset-top,0px)] font-[family-name:var(--font-inter)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 85% 55% at 50% -25%, rgba(59, 130, 246, 0.22), transparent 55%), radial-gradient(ellipse 100% 60% at 100% 100%, rgba(15, 23, 42, 0.35), transparent)",
        }}
        aria-hidden
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
          <div className="my-auto w-full max-w-[420px]">
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
              <h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>
              {description ? (
                <div className="mt-2 max-w-sm text-sm leading-relaxed text-slate-400 sm:text-base">
                  {description}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200/12 bg-white/98 p-5 shadow-[var(--enterprise-shadow-floating)] ring-1 ring-white/10 sm:p-8 [&_input:not([type=checkbox]):not([type=radio])]:min-h-12 [&_input:not([type=checkbox]):not([type=radio])]:text-base [&_select]:min-h-12 [&_select]:text-base [&_textarea]:min-h-12 [&_textarea]:text-base">
              {children}
            </div>

            <nav className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pb-2 text-center text-sm text-slate-500">
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
    </div>
  );
}
