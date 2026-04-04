import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";

export default function DashboardLoading() {
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <EnterpriseLoadingState message="Loading dashboard…" label="Loading workspace dashboard" />
      </div>
    </div>
  );
}
