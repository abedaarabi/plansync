import { Suspense } from "react";
import { OpenFromEmailClient } from "./OpenFromEmailClient";

export default function OpenPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6 text-sm text-slate-600">
          Loading…
        </div>
      }
    >
      <div className="min-h-dvh bg-slate-50">
        <OpenFromEmailClient />
      </div>
    </Suspense>
  );
}
