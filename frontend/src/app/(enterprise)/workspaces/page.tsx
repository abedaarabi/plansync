import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { WorkspacesHubClient } from "@/components/enterprise/WorkspacesHubClient";

export default function WorkspacesHubPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-[var(--enterprise-text-muted)]">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
        </div>
      }
    >
      <WorkspacesHubClient />
    </Suspense>
  );
}
