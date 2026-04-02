"use client";

import dynamic from "next/dynamic";

const PdfViewer = dynamic(
  () => import("@/components/pdf-viewer/PdfViewer").then((m) => ({ default: m.PdfViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="viewer-shell-bg flex flex-1 items-center justify-center p-8 text-sm text-slate-500">
        Loading viewer…
      </div>
    ),
  },
);

export function ViewerShell() {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <PdfViewer />
    </div>
  );
}
