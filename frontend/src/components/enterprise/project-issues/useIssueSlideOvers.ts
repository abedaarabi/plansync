/**
 * Open/close state for create + edit slide-overs, and cache refresh after save/create.
 */

"use client";

import { useCallback, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { IssueRow } from "@/lib/api-client";

export function useIssueSlideOvers(
  qc: QueryClient,
  issuesKey: readonly unknown[],
  mergeRow: (row: IssueRow) => void,
  setMsg: (m: string | null) => void,
) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<IssueRow | null>(null);

  const openCreateForm = useCallback(() => setCreateOpen(true), []);
  const closeCreateForm = useCallback(() => setCreateOpen(false), []);
  const openEditForm = useCallback((issue: IssueRow) => {
    setEditingIssue(issue);
    setEditOpen(true);
  }, []);
  const closeEditForm = useCallback(() => {
    setEditOpen(false);
    setEditingIssue(null);
  }, []);

  const handleIssueCreated = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: issuesKey });
    await qc.invalidateQueries({ queryKey: ["issues", "fileVersion"], exact: false });
    setCreateOpen(false);
    setMsg(null);
  }, [qc, issuesKey, setMsg]);

  const handleIssueSaved = useCallback(
    (row: IssueRow) => {
      mergeRow(row);
      setEditingIssue(row);
    },
    [mergeRow],
  );

  return {
    createOpen,
    editOpen,
    editingIssue,
    openCreateForm,
    closeCreateForm,
    openEditForm,
    closeEditForm,
    handleIssueCreated,
    handleIssueSaved,
  };
}
