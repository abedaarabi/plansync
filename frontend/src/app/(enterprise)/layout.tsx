import type { Metadata } from "next";
import { EnterpriseShell } from "@/components/enterprise/EnterpriseShell";

export const metadata: Metadata = {
  title: {
    default: "PlanSync",
    template: "%s · PlanSync",
  },
  description:
    "PlanSync — construction document workflows: sheets, RFIs, punch, and field reports.",
};

export default function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  return <EnterpriseShell>{children}</EnterpriseShell>;
}
