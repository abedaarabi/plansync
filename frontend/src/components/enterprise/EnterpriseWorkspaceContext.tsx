"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo } from "react";
import { fetchMe } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import type { MeResponse, MeWorkspace } from "@/types/enterprise";

export type { MeWorkspace, MeResponse } from "@/types/enterprise";

type EnterpriseWorkspaceContextValue = {
  loading: boolean;
  me: MeResponse | null;
  /** First membership — used for sidebar and org settings. */
  primary: MeWorkspace | null;
  refetch: () => Promise<void>;
};

const EnterpriseWorkspaceContext = createContext<EnterpriseWorkspaceContextValue | null>(null);

export function EnterpriseWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data: me = null, isPending: loading } = useQuery({
    queryKey: qk.me(),
    queryFn: fetchMe,
  });

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: qk.me() });
  }, [queryClient]);

  const primary = me?.workspaces?.[0] ?? null;

  const value = useMemo(() => ({ loading, me, primary, refetch }), [loading, me, primary, refetch]);

  return (
    <EnterpriseWorkspaceContext.Provider value={value}>
      {children}
    </EnterpriseWorkspaceContext.Provider>
  );
}

export function useEnterpriseWorkspace() {
  const ctx = useContext(EnterpriseWorkspaceContext);
  if (!ctx) {
    throw new Error("useEnterpriseWorkspace must be used within EnterpriseWorkspaceProvider");
  }
  return ctx;
}
