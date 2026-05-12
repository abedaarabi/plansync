import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "PlanSync Terms of Service",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-14 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-widest text-slate-400">Legal</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="mt-3 text-sm text-slate-300">Last updated: May 12, 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-200">
          <section>
            <h2 className="text-base font-semibold text-white">1. Acceptance of terms</h2>
            <p className="mt-2">
              By accessing or using PlanSync, you agree to these Terms of Service. If you do not
              agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">2. Use of the service</h2>
            <p className="mt-2">
              You may use PlanSync only for lawful business purposes. You are responsible for the
              content you upload, including project files, comments, and communications.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">3. Accounts and access</h2>
            <p className="mt-2">
              You are responsible for safeguarding account credentials and managing user access in
              your workspace. You must notify us of unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">4. Data and privacy</h2>
            <p className="mt-2">
              Your use of PlanSync is also governed by our Privacy Policy and Cookie Policy. You
              retain ownership of your project data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">5. Service availability</h2>
            <p className="mt-2">
              We work to keep PlanSync available and secure, but we cannot guarantee uninterrupted
              service. Features may change over time.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">6. Contact</h2>
            <p className="mt-2">
              Questions about these terms:{" "}
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
