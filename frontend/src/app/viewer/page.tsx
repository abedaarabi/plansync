import type { Metadata } from "next";
import { Suspense } from "react";
import { ViewerPageClient } from "@/components/ViewerPageClient";

export const metadata: Metadata = {
  title: "Viewer",
  description: "View and mark up your PDF in PlanSync.",
  alternates: {
    canonical: "/viewer",
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function ViewerPage() {
  return (
    <main className="flex h-dvh min-h-0 w-full min-w-0 flex-shrink-0 flex-col overflow-hidden">
      <Suspense
        fallback={
          <div className="viewer-shell-bg flex flex-1 items-center justify-center p-8 text-sm text-slate-500">
            Loading viewer…
          </div>
        }
      >
        <ViewerPageClient />
      </Suspense>
    </main>
  );
}
