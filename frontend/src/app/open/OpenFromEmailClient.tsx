"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function safeInternalPath(raw: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  let trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    trimmed = decodeURIComponent(trimmed);
  } catch {
    return null;
  }
  if (!trimmed) return null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (!origin) {
    if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
    return trimmed;
  }
  try {
    const u = new URL(trimmed, origin);
    if (u.origin !== new URL(origin).origin) return null;
    const out = `${u.pathname}${u.search}${u.hash}`;
    if (!out.startsWith("/") || out.startsWith("//")) return null;
    return out;
  } catch {
    return null;
  }
}

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function OpenFromEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTo = searchParams.get("to");
  const path = useMemo(() => safeInternalPath(rawTo), [rawTo]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!path) return;
    if (isStandalonePwa()) {
      router.replace(path);
    }
  }, [path, router]);

  async function copyLink() {
    if (!path || typeof window === "undefined") return;
    const full = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (!path) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Invalid link</h1>
        <p className="mt-2 text-sm text-slate-600">This open link is missing or not allowed.</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block text-sm font-medium text-blue-600 hover:underline"
        >
          Go to dashboard
        </Link>
      </div>
    );
  }

  if (isStandalonePwa()) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-slate-600">Opening…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-lg font-semibold text-slate-900">Open in the PlanSync app</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        You opened this link in the browser. On iPhone and iPad, email links usually open Safari
        instead of your Home Screen app. For notifications and the installed experience, open
        PlanSync from your <strong>Home Screen</strong> icon, then use this link there.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => void copyLink()}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <Link
          href={path}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          Continue in browser
        </Link>
      </div>
    </div>
  );
}
