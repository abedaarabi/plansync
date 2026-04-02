import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy & data",
  description: "How PlanSync uses local storage and your files in the browser.",
};

export default function PrivacyPage() {
  return (
    <div className="landing-atmosphere min-h-full font-sans text-slate-600">
      <header className="border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <h1 className="text-lg font-semibold text-slate-900">Privacy &amp; data</h1>
          <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            ← Home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <div className="space-y-5 text-sm leading-relaxed">
          <p>
            <strong className="text-slate-900">PDF files</strong> open in your browser from your
            device. They are not uploaded to our servers. What you see stays in this browser tab
            unless you use your browser&apos;s own print or download actions.
          </p>
          <p>
            <strong className="text-slate-900">Local storage</strong> keeps a small amount of data
            on your machine: the active session (markups, calibration, zoom, page), your display
            name, optional saved &quot;views&quot; for a file, and UI flags (for example dismissing
            the calibration checklist). Keys use the{" "}
            <code className="rounded bg-slate-100 px-1 text-slate-800">plansync-</code> prefix
            (older installs may still have{" "}
            <code className="rounded bg-slate-100 px-1 text-slate-800">cv-</code> keys until
            cleared).
          </p>
          <p>
            You can <strong className="text-slate-900">clear data for the current file</strong> from
            the viewer&apos;s Document panel,{" "}
            <strong className="text-slate-900">export a backup</strong> JSON from the same panel, or{" "}
            <strong className="text-slate-900">clear everything</strong> from{" "}
            <Link href="/settings" className="text-blue-600 hover:underline">
              Settings
            </Link>
            .
          </p>
          <p>
            <strong className="text-slate-900">Collaboration</strong> (room ID) only syncs between
            tabs in this browser when you use the same room ID—it does not send your PDF to a cloud
            service as part of this app.
          </p>
        </div>
        <p className="mt-10 text-center text-sm text-slate-500">
          <Link href="/settings" className="text-blue-600 hover:underline">
            Settings
          </Link>
        </p>
      </main>
    </div>
  );
}
