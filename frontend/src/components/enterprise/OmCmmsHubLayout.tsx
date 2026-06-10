"use client";

import { usePathname } from "next/navigation";
import { OmWorkOrdersHubNav } from "@/components/enterprise/OmWorkOrdersHubNav";

const HUB_TAB_RE = /\/om\/(work-orders|vendors|parts-inventory|reports)(?:\/|$)/;
const ASSETS_RE = /\/om\/assets(?:\/|$)/;

type Props = {
  projectId: string;
  children: React.ReactNode;
};

export function OmCmmsHubLayout({ projectId, children }: Props) {
  const pathname = usePathname();
  const isHub = HUB_TAB_RE.test(pathname);
  const isAssets = ASSETS_RE.test(pathname);

  if (isAssets) {
    return (
      <div className="mobile-app-page mobile-viewport-pane flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden">
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4 lg:px-8">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 px-4 pb-6 pt-3 sm:px-6 sm:pb-8 sm:pt-4 lg:px-8">
      <div className="mx-auto w-full max-w-6xl pb-[env(safe-area-inset-bottom,0px)]">
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
