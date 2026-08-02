import type { Metadata } from "next";
import { Suspense } from "react";
import { BimViewerClient } from "@/components/bim-viewer/BimViewerClient";
import { BimBootLoading } from "@/components/bim-viewer/BimLoadingOverlay";

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

export default function BimViewerPage() {
  return (
    <main className="relative flex h-dvh min-h-0 w-full min-w-0 flex-shrink-0 flex-col overflow-hidden">
      <Suspense fallback={<BimBootLoading />}>
        <BimViewerClient />
      </Suspense>
    </main>
  );
}
