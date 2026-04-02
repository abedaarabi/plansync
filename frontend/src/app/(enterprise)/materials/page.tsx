import type { Metadata } from "next";
import { MaterialsClient } from "@/components/enterprise/MaterialsClient";

export const metadata: Metadata = { title: "Materials" };

export default function MaterialsPage() {
  return (
    <div className="enterprise-animate-in h-[calc(100dvh-3.25rem)] overflow-hidden p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex h-full min-h-0 max-w-6xl flex-col">
        <MaterialsClient />
      </div>
    </div>
  );
}
