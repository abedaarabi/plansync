import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import { BimViewerClient } from "@/components/bim-viewer/BimViewerClient";

export const metadata: Metadata = {
  title: "3D Model Viewer",
  description: "Explore your building's IFC/BIM model in 3D in PlanSync.",
  alternates: {
    canonical: "/bim-viewer",
  },
  robots: {
    index: false,
    follow: true,
  },
};

function BimPageFallback() {
  return (
    <div className="bim-viewer flex flex-1 items-center justify-center p-8">
      <div className="bim-loading-card flex flex-col items-center px-8 py-9 text-center">
        <div className="bim-loading-logo relative flex h-[4.5rem] w-[4.5rem] items-center justify-center">
          <span className="bim-loading-logo__ring" aria-hidden />
          <span className="bim-loading-logo__glow" aria-hidden />
          <Image
            src="/logo.svg"
            alt=""
            width={40}
            height={40}
            className="relative"
            style={{ width: 40, height: 40 }}
            priority
          />
        </div>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--bim-text-subtle)]">
          <span className="text-[var(--bim-text)]">Plan</span>
          <span className="text-[var(--bim-accent)]">Sync</span>
        </p>
        <p className="mt-3 text-[14px] font-semibold text-[var(--bim-text)]">Loading 3D viewer…</p>
      </div>
    </div>
  );
}

export default function BimViewerPage() {
  return (
    <main className="relative flex h-dvh min-h-0 w-full min-w-0 flex-shrink-0 flex-col overflow-hidden">
      <Suspense fallback={<BimPageFallback />}>
        <BimViewerClient />
      </Suspense>
    </main>
  );
}
