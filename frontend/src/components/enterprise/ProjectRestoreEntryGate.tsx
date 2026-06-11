"use client";

import type { ReactNode } from "react";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { useProjectRestoreEntry } from "@/hooks/useProjectRestoreEntry";

type Props = {
  children: ReactNode;
  loadingMessage?: string;
};

/** Hides hub/dashboard content until last-project restore is resolved or skipped. */
export function ProjectRestoreEntryGate({ children, loadingMessage = "Loading…" }: Props) {
  const { blocking } = useProjectRestoreEntry();

  if (blocking) {
    return (
      <EnterpriseLoadingState message={loadingMessage} label="Restoring your project workspace" />
    );
  }

  return children;
}
