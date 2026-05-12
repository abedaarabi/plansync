import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "PlanSync Cookie Policy",
};

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-14 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-widest text-slate-400">Legal</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Cookie Policy</h1>
        <p className="mt-3 text-sm text-slate-300">Last updated: May 12, 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-200">
          <section>
            <h2 className="text-base font-semibold text-white">What are cookies?</h2>
            <p className="mt-2">
              Cookies are small text files stored on your device to help websites remember
              preferences, sessions, and usage settings.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">How PlanSync uses cookies</h2>
            <p className="mt-2">
              PlanSync uses essential cookies for authentication, security, and core platform
              functionality. Optional cookies may be used to improve product experience and
              performance insights.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">Managing your preferences</h2>
            <p className="mt-2">
              You can accept or reject optional cookies through the cookie consent dialog on the
              landing experience. Browser settings can also be used to clear or block cookies.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">Contact</h2>
            <p className="mt-2">
              Questions about cookies or privacy:{" "}
              <a href="mailto:support@plansync.dev" className="text-sky-300 hover:underline">
                support@plansync.dev
              </a>
            </p>
          </section>
        </div>

        <div className="mt-10">
          <Link href="/" className="text-sm font-medium text-sky-300 hover:underline">
            Back to PlanSync
          </Link>
        </div>
      </div>
    </main>
  );
}
