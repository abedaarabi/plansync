"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, CreditCard, UserPlus, Users } from "lucide-react";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import {
  WorkspaceBillingCard,
  useStripeCheckoutReturnToast,
} from "@/components/enterprise/WorkspaceBillingCard";
import { WorkspaceTeamClient } from "@/components/enterprise/WorkspaceTeamClient";
import { OrganizationBrandingPanel } from "@/components/enterprise/organization/OrganizationBrandingPanel";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import { isSuperAdmin, isWorkspaceManager } from "@/lib/workspaceRole";
import { OM_PAGE_CLASS } from "@/lib/omCompactStyles";

type OrgTab = "organization" | "billing" | "people" | "invite-member";

const TAB_COPY: Record<OrgTab, string> = {
  organization: "Name, logo, and brand color for your workspace and client-facing pages.",
  billing: "Compare plans, upgrade with Stripe, and manage invoices for this workspace.",
  people: "Seats, roles, and pending invites for everyone in this organization.",
  "invite-member": "Send a branded email invite to teammates, clients, or trade partners.",
};

export function OrganizationClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  useStripeCheckoutReturnToast("/organization?tab=billing");
  const wid = primary?.workspace.id;
  const isManager = isWorkspaceManager(primary?.role);
  const superAdmin = isSuperAdmin(primary?.role);
  const ws = primary?.workspace;

  const [tab, setTabState] = useState<OrgTab>("organization");

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "billing") {
      if (superAdmin) setTabState("billing");
      else {
        setTabState("organization");
        router.replace("/organization?tab=organization", { scroll: false });
      }
    } else if (t === "invite-member" && isManager) setTabState("invite-member");
    else if (t === "people") setTabState("people");
    else if (t === "organization") setTabState("organization");
  }, [searchParams, isManager, superAdmin, router]);

  useEffect(() => {
    if (!isManager && tab === "invite-member") {
      setTabState("organization");
      router.replace("/organization?tab=organization", { scroll: false });
    }
  }, [isManager, tab, router]);

  function setTab(id: OrgTab) {
    setTabState(id);
    router.replace(`/organization?tab=${id}`, { scroll: false });
  }

  if (ctxLoading) {
    return (
      <EnterpriseLoadingState
        message="Loading organization…"
        label="Loading organization settings"
      />
    );
  }

  if (!primary || !ws || !wid) {
    return (
      <div className="enterprise-card p-8">
        <p className="text-sm text-[var(--enterprise-text-muted)]">
          You are not in a workspace yet. Create one from the API or ask an admin for an invite
          link.
        </p>
      </div>
    );
  }

  const roleLabel =
    primary.role === "SUPER_ADMIN" ? "Super Admin" : primary.role === "ADMIN" ? "Admin" : "Member";

  const tabs: { id: OrgTab; label: string; icon: typeof Building2; show: boolean }[] = [
    { id: "organization", label: "Branding", icon: Building2, show: true },
    { id: "billing", label: "Plan & billing", icon: CreditCard, show: superAdmin },
    { id: "people", label: "People", icon: Users, show: true },
    { id: "invite-member", label: "Invite member", icon: UserPlus, show: isManager },
  ];

  return (
    <div className={OM_PAGE_CLASS}>
      <OmSubPageHeader icon={Building2} title="Organization" description={TAB_COPY[tab]} />

      <div
        className="flex gap-1 overflow-x-auto border-b border-[var(--enterprise-border)] pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Organization sections"
      >
        {tabs
          .filter((t) => t.show)
          .map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={
                  active
                    ? "mobile-touch-target inline-flex shrink-0 items-center gap-1.5 border-b-2 border-[var(--enterprise-primary)] px-3 py-2.5 text-xs font-semibold text-[var(--enterprise-text)]"
                    : "mobile-touch-target inline-flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-xs font-medium text-[var(--enterprise-text-muted)] transition hover:text-[var(--enterprise-text)]"
                }
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {t.label}
              </button>
            );
          })}
      </div>

      {tab === "organization" ? (
        <OrganizationBrandingPanel
          workspaceId={wid}
          workspace={ws}
          roleLabel={roleLabel}
          canEdit={superAdmin}
        />
      ) : null}

      {tab === "billing" && superAdmin ? (
        <WorkspaceBillingCard workspaceId={wid} workspace={ws} isSuperAdmin={superAdmin} />
      ) : null}

      {tab === "people" ? <WorkspaceTeamClient embedded variant="full" /> : null}

      {tab === "invite-member" && isManager ? (
        <WorkspaceTeamClient embedded variant="inviteOnly" />
      ) : null}
    </div>
  );
}
