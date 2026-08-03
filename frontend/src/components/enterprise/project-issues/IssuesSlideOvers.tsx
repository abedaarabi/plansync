/**
 * Create / edit / delete overlays for the issues list.
 * Switches between issue vs work-order slide-overs based on `isWorkOrders`.
 */

"use client";

import { DeleteProjectIssueConfirmDialog } from "@/components/enterprise/DeleteProjectIssueConfirmDialog";
import { IssueCreateSlideOver } from "@/components/enterprise/IssueCreateSlideOver";
import { IssueEditSlideOver } from "@/components/enterprise/IssueEditSlideOver";
import { WorkOrderCreateSlideOver } from "@/components/enterprise/WorkOrderCreateSlideOver";
import { WorkOrderEditSlideOver } from "@/components/enterprise/WorkOrderEditSlideOver";
import type { IssueRow, WorkspaceMemberRow } from "@/lib/api-client";

type IssuesSlideOversProps = {
  isWorkOrders: boolean;
  createOpen: boolean;
  editOpen: boolean;
  editingIssue: IssueRow | null;
  deleteConfirmIssue: IssueRow | null;
  deletePending: boolean;
  entitySingular: string;
  projectId: string;
  workspaceId: string | undefined;
  wid: string | undefined;
  isPro: boolean;
  members: WorkspaceMemberRow[];
  filterAssetId?: string;
  onCreated: () => void;
  onCreateClose: () => void;
  onEditClose: () => void;
  onSaved: (row: IssueRow) => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
};

export function IssuesSlideOvers(props: IssuesSlideOversProps) {
  const createOver = props.isWorkOrders ? (
    <WorkOrderCreateSlideOver
      open={props.createOpen}
      onClose={props.onCreateClose}
      projectId={props.projectId}
      workspaceId={props.workspaceId}
      members={props.members}
      initialAssetId={props.filterAssetId}
      onCreated={props.onCreated}
    />
  ) : (
    <IssueCreateSlideOver
      open={props.createOpen}
      onClose={props.onCreateClose}
      projectId={props.projectId}
      workspaceId={props.workspaceId}
      wid={props.wid}
      isPro={props.isPro}
      members={props.members}
      onCreated={props.onCreated}
    />
  );
  const editOver = props.isWorkOrders ? (
    <WorkOrderEditSlideOver
      open={props.editOpen}
      issue={props.editingIssue}
      projectId={props.projectId}
      onClose={props.onEditClose}
      members={props.members}
      onSaved={props.onSaved}
    />
  ) : (
    <IssueEditSlideOver
      open={props.editOpen}
      issue={props.editingIssue}
      onClose={props.onEditClose}
      members={props.members}
      onSaved={props.onSaved}
    />
  );
  return (
    <>
      {createOver}
      {editOver}
      <DeleteProjectIssueConfirmDialog
        open={Boolean(props.deleteConfirmIssue)}
        title={props.deleteConfirmIssue?.title ?? ""}
        entityLabel={props.entitySingular}
        isDeleting={props.deletePending}
        onCancel={props.onDeleteCancel}
        onConfirm={props.onDeleteConfirm}
      />
    </>
  );
}
