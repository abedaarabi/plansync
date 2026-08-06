"use client";

import { usePathname } from "next/navigation";
import { OmWorkOrdersHubNav } from "@/components/enterprise/OmWorkOrdersHubNav";
import { PlanUpgradeCallout } from "@/components/enterprise/PlanUpgradeCallout";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import { isWorkspaceOmBillingClient } from "@/lib/workspaceSubscription";

const HUB_TAB_RE = /\/om\/(work-orders|vendors|parts-inventory|reports)(?:\/|$)/;
const ASSETS_RE = /\/om\/assets(?:\/|$)/;

type Props = {
  projectId: string;
  children: React.ReactNode;
};

export function OmCmmsHubLayout({ projectId, children }: Props) {
  const pathname = usePathname();
  const { primary, loading } = useEnterpriseWorkspace();
  const omBilling = isWorkspaceOmBillingClient(primary?.workspace);
  const isHub = HUB_TAB_RE.test(pathname);
  const isAssets = ASSETS_RE.test(pathname);

  if (loading) {
    return <EnterpriseLoadingState label="Loading workspace…" />;
  }

  if (!omBilling) {
    return (
      <div className="mobile-app-page w-full px-4 py-6 sm:px-5 lg:px-8">
        <PlanUpgradeCallout
          feature="Operations & Maintenance"
          requiredPlan="Enterprise"
          detail="Upgrade to Enterprise for assets, work orders, maintenance, inspections, and the tenant portal."
        />
      </div>
    );
  }

  if (isAssets) {
    return (
      <div className="mobile-app-page mobile-viewport-pane flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden">
        <div className="mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col px-4 pb-4 pt-3 sm:px-5 sm:pb-6 sm:pt-4 lg:max-w-6xl lg:px-8">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-app-page w-full min-w-0 max-w-full px-4 pb-6 pt-3 sm:px-5 sm:pb-8 sm:pt-4 lg:px-8">
      <div className="mx-auto w-full max-w-full pb-[env(safe-area-inset-bottom,0px)] lg:max-w-6xl">
        {isHub ? (
          <div className="mb-3 border-b border-[var(--enterprise-border)] pb-3">
            <OmWorkOrdersHubNav projectId={projectId} />
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
