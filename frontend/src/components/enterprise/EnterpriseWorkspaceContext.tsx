"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from "react";
import { fetchMe } from "@/lib/api-client";
import { workspaceEnterpriseCssVars } from "@/lib/enterpriseTheme";
import { qk } from "@/lib/queryKeys";
import type { MeResponse, MeWorkspace } from "@/types/enterprise";
import {
  getPreferredWorkspaceId,
  resolvePrimaryMembership,
  setPreferredWorkspaceId,
} from "@/lib/workspacePreference";

export type { MeWorkspace, MeResponse } from "@/types/enterprise";

type EnterpriseWorkspaceContextValue = {
  loading: boolean;
  isError: boolean;
  meError: unknown;
  me: MeResponse | null;
  /** Membership used for `/projects`, dashboard, org, and other non–URL-scoped routes. */
  primary: MeWorkspace | null;
  /** Persists preference and updates shell state (sidebar, theme, queries keyed on primary). */
  setActiveWorkspaceId: (workspaceId: string) => void;
  refetch: () => Promise<void>;
};

const EnterpriseWorkspaceContext = createContext<EnterpriseWorkspaceContextValue | null>(null);

export function EnterpriseWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const {
    data: me = null,
    isPending: loading,
    error: meError,
    isError: meIsError,
  } = useQuery({
    queryKey: qk.me(),
    queryFn: fetchMe,
  });

  const [preferredId, setPreferredId] = useState<string | null>(null);

  useLayoutEffect(() => {
    setPreferredId(getPreferredWorkspaceId());
  }, []);

  const setActiveWorkspaceId = useCallback((workspaceId: string) => {
    setPreferredWorkspaceId(workspaceId);
    setPreferredId(workspaceId);
  }, []);

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: qk.me() });
  }, [queryClient]);

  const primary = useMemo(() => resolvePrimaryMembership(me, preferredId), [me, preferredId]);

  const value = useMemo(
    () => ({
      loading,
      isError: meIsError,
      meError,
      me,
      primary,
      setActiveWorkspaceId,
      refetch,
    }),
    [loading, meIsError, meError, me, primary, setActiveWorkspaceId, refetch],
  );

  const themeStyle = useMemo(
    () => workspaceEnterpriseCssVars(primary?.workspace.primaryColor),
    [primary?.workspace.primaryColor],
  );

  return (
    <EnterpriseWorkspaceContext.Provider value={value}>
      <div className="contents" style={themeStyle}>
        {children}
      </div>
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
