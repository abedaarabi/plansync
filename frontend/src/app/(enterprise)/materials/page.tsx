import type { Metadata } from "next";
import { MaterialsClient } from "@/components/enterprise/MaterialsClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";

export const metadata: Metadata = { title: "Materials" };

export default function MaterialsPage() {
  return (
    <EnterpriseCompactPageShell fullHeight>
      <MaterialsClient />
    </EnterpriseCompactPageShell>
  );
}
