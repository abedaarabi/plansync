import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { FileQuestion, Home, Ruler } from "lucide-react";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="landing-atmosphere landing-dots flex min-h-dvh flex-col items-center justify-center px-5 py-16 font-sans">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white/90 px-8 py-12 text-center shadow-[0_1px_0_0_rgba(255,255,255,0.8)_inset,0_8px_32px_-8px_rgba(15,23,42,0.12)] backdrop-blur-md sm:px-10">
        <div className="mb-6 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-md shadow-slate-900/10 ring-1 ring-slate-200/70">
            <Image
              src="/logo.svg"
              alt="PlanSync"
              width={32}
              height={32}
              className="h-8 w-8"
              priority
            />
          </div>
        </div>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500/15 to-blue-600/5 text-blue-600 ring-1 ring-blue-500/10">
          <FileQuestion className="h-8 w-8" strokeWidth={1.5} aria-hidden />
        </div>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          This page doesn&apos;t exist
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
          The link may be broken or the page was moved. Head home to open a plan or try the viewer
          directly.
        </p>
        <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="btn-shine inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-b from-blue-500 to-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.16),0_1px_2px_rgba(0,0,0,0.05),0_4px_12px_rgba(37,99,235,0.3)] transition hover:from-blue-600 hover:to-blue-700 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.16),0_1px_2px_rgba(0,0,0,0.05),0_8px_24px_rgba(37,99,235,0.35)] active:scale-[0.98]"
          >
            <Home className="h-4 w-4 shrink-0" aria-hidden />
            Back to home
          </Link>
          <Link
            href="/viewer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-6 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
          >
            <Ruler className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />
            Open viewer
          </Link>
        </div>
      </div>
    </div>
  );
}
