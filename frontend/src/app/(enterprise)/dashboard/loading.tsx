import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";

export default function DashboardLoading() {
  return (
    <div className="mobile-app-page enterprise-animate-in w-full max-w-full p-4 sm:p-5 lg:p-8">
      <div className="mx-auto w-full max-w-full lg:max-w-6xl">
        <EnterpriseLoadingState message="Loading dashboard…" label="Loading workspace dashboard" />
      </div>
    </div>
  );
}
