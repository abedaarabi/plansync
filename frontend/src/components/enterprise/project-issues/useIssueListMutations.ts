/**
 * Patch / promote / delete mutations for the issues list, plus cache merge + toasts.
 * Returns busy ids so rows can disable their own controls while a request is in flight.
 */

"use client";

import { useCallback, useState } from "react";
import { useMutation, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  deleteIssue,
  formatIssueLockHint,
  patchIssue,
  ProRequiredError,
  type IssueRow,
} from "@/lib/api-client";
import { mergeIssueRowIntoLists } from "@/lib/issueListFilters";
import { toastIssueActionError } from "./helpers";

function usePatchIssueMut(mergeRow: (row: IssueRow) => void, setMsg: (m: string | null) => void) {
  const [patchingIssueId, setPatchingIssueId] = useState<string | null>(null);
  const patchMut = useMutation({
    mutationFn: (vars: { id: string; status: string }) =>
      patchIssue(vars.id, { status: vars.status }),
    onMutate: (vars) => setPatchingIssueId(vars.id),
    onSuccess: mergeRow,
    onError: (e: Error) => {
      setMsg(e instanceof ProRequiredError ? "Pro subscription required." : formatIssueLockHint(e));
      toastIssueActionError(e);
    },
    onSettled: () => setPatchingIssueId(null),
  });
  return { patchMut, patchingIssueId };
}

function usePromoteIssueMut(
  qc: QueryClient,
  projectId: string,
  setMsg: (m: string | null) => void,
) {
  const [promotingIssueId, setPromotingIssueId] = useState<string | null>(null);
  const promoteMut = useMutation({
    mutationFn: (id: string) => patchIssue(id, { issueKind: "WORK_ORDER" }),
    onMutate: setPromotingIssueId,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["issues", "project", projectId], exact: false });
      await qc.invalidateQueries({ queryKey: ["issues", "fileVersion"], exact: false });
      toast.success("Promoted to work order.");
      setMsg(null);
    },
    onError: toastIssueActionError,
    onSettled: () => setPromotingIssueId(null),
  });
  return { promoteMut, promotingIssueId };
}

function useDeleteIssueMut(
  qc: QueryClient,
  issuesKey: readonly unknown[],
  entitySingular: string,
  setMsg: (m: string | null) => void,
) {
  const [deletingIssueId, setDeletingIssueId] = useState<string | null>(null);
  const [deleteConfirmIssue, setDeleteConfirmIssue] = useState<IssueRow | null>(null);
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteIssue(id),
    onMutate: setDeletingIssueId,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: issuesKey });
      await qc.invalidateQueries({ queryKey: ["issues", "fileVersion"], exact: false });
      setDeleteConfirmIssue(null);
      toast.success(`${entitySingular.charAt(0).toUpperCase()}${entitySingular.slice(1)} deleted.`);
      setMsg(null);
    },
    onError: toastIssueActionError,
    onSettled: () => setDeletingIssueId(null),
  });
  const confirmDelete = useCallback(() => {
    if (deleteConfirmIssue) deleteMut.mutate(deleteConfirmIssue.id);
  }, [deleteConfirmIssue, deleteMut]);
  const cancelDelete = useCallback(() => setDeleteConfirmIssue(null), []);
  return {
    deleteMut,
    deletingIssueId,
    deleteConfirmIssue,
    setDeleteConfirmIssue,
    confirmDelete,
    cancelDelete,
  };
}

export function useIssueListMutations(
  qc: QueryClient,
  issuesKey: readonly unknown[],
  projectId: string,
  entitySingular: string,
) {
  const [msg, setMsg] = useState<string | null>(null);
  const mergeRow = useCallback(
    (row: IssueRow) => {
      mergeIssueRowIntoLists(qc, issuesKey, row);
      setMsg(null);
    },
    [qc, issuesKey],
  );
  const patch = usePatchIssueMut(mergeRow, setMsg);
  const promote = usePromoteIssueMut(qc, projectId, setMsg);
  const del = useDeleteIssueMut(qc, issuesKey, entitySingular, setMsg);
  return { msg, setMsg, mergeRow, ...patch, ...promote, ...del };
}
