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
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 45% at 50% -10%, rgba(37, 99, 235, 0.14), transparent 55%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
          <div className="my-auto w-full max-w-[400px]">
            <div className="mb-7 flex flex-col items-center text-center">
              <Link
                href="/"
                className="mb-5 flex h-11 w-11 items-center justify-center rounded-md border border-white/10 bg-white transition hover:border-white/20"
              >
                <Image
                  src="/logo.svg"
                  alt="PlanSync"
                  width={32}
                  height={32}
                  className="h-8 w-8"
                  priority
                />
              </Link>
              <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {title}
              </h1>
              {description ? (
                <div className="mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
                  {description}
                </div>
              ) : null}
            </div>

            <div className="enterprise-auth-card [&_input:not([type=checkbox]):not([type=radio])]:min-h-11 [&_input:not([type=checkbox]):not([type=radio])]:text-[0.9375rem] [&_select]:min-h-11 [&_select]:text-[0.9375rem] [&_textarea]:min-h-11 [&_textarea]:text-[0.9375rem]">
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
