"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  CalendarClock,
  Camera,
  ChevronLeft,
  ClipboardList,
  Clock,
  ExternalLink,
  FileText,
  Layers,
  Link2,
  MapPin,
  MessageSquare,
  Pencil,
  Send,
  Trash2,
  User,
  UserRound,
  Wrench,
} from "lucide-react";
import { DeleteProjectIssueConfirmDialog } from "@/components/enterprise/DeleteProjectIssueConfirmDialog";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { IssueEditSlideOver } from "@/components/enterprise/IssueEditSlideOver";
import { EnterpriseResponsiveDialog } from "@/components/mobile/EnterpriseResponsiveDialog";
import {
  createIssueComment,
  deleteIssue,
  fetchIssue,
  fetchIssueComments,
  fetchWorkspaceMembers,
  formatIssueLockHint,
  patchIssue,
  presignReadIssueReferencePhoto,
  ProRequiredError,
  viewerHrefForIssue,
  type IssueCommentRow,
  type IssueReferencePhotoRow,
  type IssueRow,
  type IssueUserRef,
} from "@/lib/api-client";
import { isIssueOverdue, issueOverviewShortDate } from "@/lib/issuesOverviewStats";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_ORDER,
  issueDateToInputValue,
  issueStatusBadgeClassLight,
  priorityBadgeClassLight,
  RFI_STATUS_LABEL,
  rfiStatusBadgeClass,
} from "@/lib/issueStatusStyle";
import { MOBILE_FIELD_TEXTAREA } from "@/lib/mobileFormStyles";
import { qk } from "@/lib/queryKeys";
import { useTickNowMs } from "@/lib/useTickNowMs";
import { userInitials } from "@/lib/user-initials";

const EDIT_BTN =
  "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:bg-[var(--enterprise-hover-surface)] max-lg:min-h-11";
const DELETE_BTN =
  "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--enterprise-semantic-danger-text)] transition hover:bg-red-100 disabled:opacity-50 max-lg:min-h-11";
const OVERDUE_CHIP =
  "rounded-md border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--enterprise-semantic-danger-text)]";

type PhotoLightboxState = { url: string; title: string } | null;

function fullDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function commentTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function issueSheetLabel(issue: IssueRow): string | null {
  const name = issue.sheetName?.trim() || issue.file?.name?.trim();
  if (!name) return null;
  const ver = issue.sheetVersion ?? issue.fileVersion?.version;
  return ver != null ? `${name} · v${ver}` : name;
}

function UserAvatar({ user }: { user: IssueUserRef | null }) {
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--enterprise-primary)]/10 text-[10px] font-bold text-[var(--enterprise-primary)]"
      aria-hidden
    >
      {userInitials(user?.name, user?.email)}
    </span>
  );
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="enterprise-card min-w-0 p-4 sm:p-5">
      <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        {title}
      </h2>
      <div className="mt-3 min-w-0">{children}</div>
    </section>
  );
}

function MetaRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 border-b border-[var(--enterprise-border)]/70 py-2.5 first:pt-0 last:border-0 last:pb-0">
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
        strokeWidth={1.75}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-[var(--enterprise-text-muted)]">{label}</p>
        <div className="mt-0.5 text-sm text-[var(--enterprise-text)]">{children}</div>
      </div>
    </div>
  );
}

function PersonMetaRow({
  icon,
  label,
  user,
  emptyLabel,
}: {
  icon: LucideIcon;
  label: string;
  user: IssueUserRef | null;
  emptyLabel: string;
}) {
  return (
    <MetaRow icon={icon} label={label}>
      {user ? (
        <span className="flex items-center gap-2">
          <UserAvatar user={user} />
          <span className="min-w-0 truncate">{user.name?.trim() || user.email}</span>
        </span>
      ) : (
        <span className="text-[var(--enterprise-text-muted)]">{emptyLabel}</span>
      )}
    </MetaRow>
  );
}

function HeaderBadges({
  issue,
  overdue,
  patchPending,
  onStatusChange,
}: {
  issue: IssueRow;
  overdue: boolean;
  patchPending: boolean;
  onStatusChange: (status: string) => void;
}) {
  const pri = issue.priority ?? "MEDIUM";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {issue.displayNumber != null ? (
        <span className="inline-flex items-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 py-1 font-mono text-xs font-semibold tabular-nums text-[var(--enterprise-text-muted)]">
          #{String(issue.displayNumber).padStart(3, "0")}
        </span>
      ) : null}
      <label className="inline-flex">
        <span className="sr-only">Status</span>
        <select
          value={issue.status}
          onChange={(e) => onStatusChange(e.target.value)}
          disabled={patchPending}
          className={`cursor-pointer rounded-lg border-0 px-2.5 py-1.5 text-xs font-semibold shadow-sm outline-none transition focus:ring-2 focus:ring-blue-500/25 disabled:opacity-50 ${issueStatusBadgeClassLight(issue.status)}`}
        >
          {ISSUE_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {ISSUE_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <span
        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${priorityBadgeClassLight(pri)}`}
      >
        {ISSUE_PRIORITY_LABEL[pri] ?? pri} priority
      </span>
      {overdue ? <span className={OVERDUE_CHIP}>Overdue</span> : null}
    </div>
  );
}

function IssueDetailHeader({
  issue,
  projectId,
  viewerHref,
  overdue,
  patchPending,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  issue: IssueRow;
  projectId: string;
  viewerHref: string | null;
  overdue: boolean;
  patchPending: boolean;
  onStatusChange: (status: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <header className="enterprise-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link
          href={`/projects/${projectId}/issues`}
          className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-[var(--enterprise-text-muted)] transition hover:text-[var(--enterprise-primary)]"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          All issues
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onEdit} className={EDIT_BTN}>
            <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Edit
          </button>
          <button type="button" onClick={onDelete} className={DELETE_BTN}>
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Delete
          </button>
        </div>
      </div>

      <HeaderBadges
        issue={issue}
        overdue={overdue}
        patchPending={patchPending}
        onStatusChange={onStatusChange}
      />

      <h1 className="mt-3 text-xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-2xl">
        {issue.title}
      </h1>
      <p className="mt-1.5 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
        Created {fullDate(issue.createdAt)} by{" "}
        {issue.creator?.name?.trim() || issue.creator?.email?.trim() || "Unknown"} · Updated{" "}
        {issueOverviewShortDate(issue.updatedAt)}
        {(issue.commentCount ?? 0) > 0 ? ` · ${issue.commentCount} comments` : ""}
      </p>

      {viewerHref ? (
        <div className="mt-4 border-t border-[var(--enterprise-border)]/80 pt-4">
          <Link
            href={viewerHref}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--enterprise-primary-deep)] max-lg:w-full"
          >
            Open in {issue.bimAnchor ? "BIM viewer" : "viewer"}
            <ExternalLink className="h-4 w-4 opacity-90" strokeWidth={2} aria-hidden />
          </Link>
        </div>
      ) : null}
    </header>
  );
}

function DetailsSection({ issue, nowMs }: { issue: IssueRow; nowMs: number }) {
  const overdue = isIssueOverdue(issue, nowMs);
  const dueLabel = issueDateToInputValue(issue.dueDate);
  return (
    <DetailSection title="Details" icon={ClipboardList}>
      <PersonMetaRow
        icon={UserRound}
        label="Assignee"
        user={issue.assignee}
        emptyLabel="Unassigned"
      />
      <PersonMetaRow icon={User} label="Created by" user={issue.creator} emptyLabel="—" />
      <MetaRow icon={Calendar} label="Created">
        {fullDate(issue.createdAt)}
      </MetaRow>
      <MetaRow icon={Clock} label="Last updated">
        {fullDate(issue.updatedAt)}
      </MetaRow>
      <MetaRow icon={Calendar} label="Start date">
        {issueDateToInputValue(issue.startDate) || "—"}
      </MetaRow>
      <MetaRow icon={CalendarClock} label="Due date">
        {dueLabel ? (
          <span className="flex flex-wrap items-center gap-2 tabular-nums">
            {dueLabel}
            {overdue ? <span className={OVERDUE_CHIP}>Overdue</span> : null}
          </span>
        ) : (
          "—"
        )}
      </MetaRow>
      {issue.levelName?.trim() ? (
        <MetaRow icon={MapPin} label="Level">
          {issue.levelName.trim()}
        </MetaRow>
      ) : null}
      <MetaRow icon={MapPin} label="Location">
        {issue.location?.trim() || "—"}
      </MetaRow>
      {issue.asset ? (
        <MetaRow icon={Wrench} label="Asset">
          {issue.asset.tag} · {issue.asset.name}
        </MetaRow>
      ) : null}
    </DetailSection>
  );
}

function LocationSection({ issue, viewerHref }: { issue: IssueRow; viewerHref: string | null }) {
  const sheetLabel = issueSheetLabel(issue);
  const bim = issue.bimAnchor;
  return (
    <DetailSection title="Sheet & model" icon={MapPin}>
      {sheetLabel ? (
        <MetaRow icon={FileText} label="Sheet">
          {sheetLabel}
          {issue.pageNumber != null ? ` · Page ${issue.pageNumber}` : ""}
        </MetaRow>
      ) : null}
      {bim ? (
        <MetaRow icon={Layers} label="Model element">
          {bim.name?.trim() || bim.ifcType || "BIM element"}
          {bim.spatialPath?.length ? (
            <span className="mt-0.5 block truncate text-xs text-[var(--enterprise-text-muted)]">
              {bim.spatialPath.join(" › ")}
            </span>
          ) : null}
        </MetaRow>
      ) : null}
      {!sheetLabel && !bim ? (
        <p className="text-sm text-[var(--enterprise-text-muted)]">
          Not pinned to a sheet or model element.
        </p>
      ) : null}
      {viewerHref ? (
        <Link
          href={viewerHref}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--enterprise-primary)] hover:underline"
        >
          Open in viewer
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ) : null}
    </DetailSection>
  );
}

function LinkedRfisSection({ issue, projectId }: { issue: IssueRow; projectId: string }) {
  if (issue.linkedRfis.length === 0) return null;
  return (
    <DetailSection title="Linked RFIs" icon={Link2}>
      <ul className="space-y-2">
        {issue.linkedRfis.map((r) => (
          <li key={r.id}>
            <Link
              href={`/projects/${projectId}/rfi/${r.id}`}
              className="flex items-center gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35 hover:bg-[var(--enterprise-primary-soft)]/40"
            >
              <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-[var(--enterprise-text-muted)]">
                #{String(r.rfiNumber).padStart(3, "0")}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--enterprise-text)]">
                {r.title}
              </span>
              <span
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${rfiStatusBadgeClass(r.status)}`}
              >
                {RFI_STATUS_LABEL[r.status] ?? r.status}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </DetailSection>
  );
}

function DescriptionSection({ issue }: { issue: IssueRow }) {
  return (
    <DetailSection title="Description" icon={FileText}>
      {issue.description?.trim() ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--enterprise-text)]">
          {issue.description}
        </p>
      ) : (
        <p className="text-sm text-[var(--enterprise-text-muted)]">No description provided.</p>
      )}
    </DetailSection>
  );
}

function PhotoThumb({
  issueId,
  photo,
  onOpen,
}: {
  issueId: string;
  photo: IssueReferencePhotoRow;
  onOpen: (url: string) => void;
}) {
  const { data: url, isPending } = useQuery({
    queryKey: qk.issueRefPhotoReadUrl(issueId, photo.id),
    queryFn: () => presignReadIssueReferencePhoto(issueId, photo.id),
    staleTime: 60_000,
  });
  return (
    <li>
      <button
        type="button"
        disabled={!url}
        onClick={() => url && onOpen(url)}
        aria-label={`Open photo ${photo.fileName}`}
        className="block aspect-square w-full overflow-hidden rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] transition hover:border-[var(--enterprise-primary)]/40 focus-visible:outline-none focus-visible:ring-2 focus:ring-[var(--enterprise-primary)]/35"
      >
        {isPending || !url ? (
          <span className="block h-full w-full animate-pulse bg-[var(--enterprise-border)]/40" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={photo.fileName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}
      </button>
    </li>
  );
}

function PhotosSection({
  issue,
  onOpenPhoto,
}: {
  issue: IssueRow;
  onOpenPhoto: (photo: PhotoLightboxState) => void;
}) {
  const photos = issue.referencePhotos ?? [];
  return (
    <DetailSection
      title={`Reference photos${photos.length > 0 ? ` (${photos.length})` : ""}`}
      icon={Camera}
    >
      {photos.length === 0 ? (
        <p className="text-sm text-[var(--enterprise-text-muted)]">No reference photos attached.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <PhotoThumb
              key={p.id}
              issueId={issue.id}
              photo={p}
              onOpen={(url) => onOpenPhoto({ url, title: p.fileName })}
            />
          ))}
        </ul>
      )}
    </DetailSection>
  );
}

function PhotoLightboxDialog({
  lightbox,
  onClose,
}: {
  lightbox: PhotoLightboxState;
  onClose: () => void;
}) {
  return (
    <EnterpriseResponsiveDialog
      open={Boolean(lightbox)}
      onClose={onClose}
      ariaLabelledBy="issue-photo-lightbox-title"
      panelClassName="max-w-3xl overflow-hidden p-0"
      bodyClassName="p-0"
    >
      <div className="border-b border-[var(--enterprise-border)] px-4 py-3">
        <h2
          id="issue-photo-lightbox-title"
          className="truncate text-sm font-semibold text-[var(--enterprise-text)]"
        >
          {lightbox?.title ?? "Reference photo"}
        </h2>
      </div>
      {lightbox ? (
        <div className="bg-black/5 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.url} alt="" className="mx-auto max-h-[70dvh] w-full object-contain" />
        </div>
      ) : null}
    </EnterpriseResponsiveDialog>
  );
}

function CommentThreadItem({ comment }: { comment: IssueCommentRow }) {
  return (
    <li className="flex gap-2.5">
      <UserAvatar user={comment.author} />
      <div className="min-w-0 flex-1 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/60 px-3 py-2">
        <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
          <span className="font-semibold text-[var(--enterprise-text)]">
            {comment.author.name?.trim() || comment.author.email}
          </span>
          <span className="text-[var(--enterprise-text-muted)]">
            {commentTimestamp(comment.createdAt)}
          </span>
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--enterprise-text)]">
          {comment.body}
        </p>
      </div>
    </li>
  );
}

function CommentForm({
  body,
  posting,
  onChange,
  onSubmit,
}: {
  body: string;
  posting: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="mt-4 border-t border-[var(--enterprise-border)]/80 pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="issue-comment-body" className="sr-only">
        Add a comment
      </label>
      <textarea
        id="issue-comment-body"
        value={body}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Add a comment…"
        rows={3}
        className={MOBILE_FIELD_TEXTAREA}
      />
      <div className="mt-2 flex justify-end">
        <button
          type="submit"
          disabled={!body.trim() || posting}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--enterprise-primary-deep)] disabled:opacity-50 max-lg:w-full"
        >
          <Send className="h-4 w-4" aria-hidden />
          {posting ? "Posting…" : "Post comment"}
        </button>
      </div>
    </form>
  );
}

function CommentsSection({ issueId }: { issueId: string }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const { data: comments = [], isPending } = useQuery({
    queryKey: qk.issueComments(issueId),
    queryFn: () => fetchIssueComments(issueId),
  });
  const postMut = useMutation({
    mutationFn: (text: string) => createIssueComment(issueId, text),
    onSuccess: (row) => {
      qc.setQueryData<IssueCommentRow[]>(qk.issueComments(issueId), (old) => [
        ...(old ?? []),
        { id: row.id, body: row.body, createdAt: row.createdAt, author: row.author },
      ]);
      qc.setQueryData<IssueRow | undefined>(qk.issueById(issueId), (old) =>
        old ? { ...old, commentCount: row.commentCount } : old,
      );
      setBody("");
      toast.success("Comment added.");
    },
    onError: (e: Error) => {
      toast.error(
        e instanceof ProRequiredError ? "Pro subscription required." : formatIssueLockHint(e),
      );
    },
  });

  return (
    <DetailSection title={`Comments (${comments.length})`} icon={MessageSquare}>
      {isPending ? (
        <EnterpriseLoadingState
          variant="minimal"
          message="Loading comments…"
          label="Loading issue comments"
        />
      ) : comments.length === 0 ? (
        <p className="text-sm text-[var(--enterprise-text-muted)]">
          No comments yet. Start the discussion below.
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <CommentThreadItem key={c.id} comment={c} />
          ))}
        </ul>
      )}
      <CommentForm
        body={body}
        posting={postMut.isPending}
        onChange={setBody}
        onSubmit={() => {
          const text = body.trim();
          if (text) postMut.mutate(text);
        }}
      />
    </DetailSection>
  );
}

function IssueDetailBody({
  issue,
  projectId,
  viewerHref,
  nowMs,
  onOpenPhoto,
}: {
  issue: IssueRow;
  projectId: string;
  viewerHref: string | null;
  nowMs: number;
  onOpenPhoto: (photo: PhotoLightboxState) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <div className="min-w-0 space-y-3 lg:col-span-2">
        <DescriptionSection issue={issue} />
        <PhotosSection issue={issue} onOpenPhoto={onOpenPhoto} />
        <CommentsSection issueId={issue.id} />
      </div>
      <div className="min-w-0 space-y-3">
        <DetailsSection issue={issue} nowMs={nowMs} />
        <LocationSection issue={issue} viewerHref={viewerHref} />
        <LinkedRfisSection issue={issue} projectId={projectId} />
      </div>
    </div>
  );
}

function useIssueDetailMutations(issueId: string, projectId: string) {
  const qc = useQueryClient();
  const router = useRouter();

  const applyRow = useCallback(
    (row: IssueRow) => {
      qc.setQueryData(qk.issueById(row.id), row);
      const mergeList = (old: IssueRow[] | undefined) =>
        old?.some((i) => i.id === row.id) ? old.map((i) => (i.id === row.id ? row : i)) : old;
      qc.setQueriesData<IssueRow[]>({ queryKey: ["issues", "project"], exact: false }, mergeList);
      qc.setQueriesData<IssueRow[]>(
        { queryKey: ["issues", "fileVersion"], exact: false },
        mergeList,
      );
    },
    [qc],
  );

  const onMutError = useCallback((e: Error) => {
    toast.error(
      e instanceof ProRequiredError ? "Pro subscription required." : formatIssueLockHint(e),
    );
  }, []);

  const patchMut = useMutation({
    mutationFn: (status: string) => patchIssue(issueId, { status }),
    onSuccess: applyRow,
    onError: onMutError,
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteIssue(issueId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["issues"], exact: false });
      toast.success("Issue deleted.");
      router.push(`/projects/${projectId}/issues`);
    },
    onError: onMutError,
  });

  return { applyRow, patchMut, deleteMut };
}

export function IssueDetailClient({ projectId, issueId }: { projectId: string; issueId: string }) {
  const nowMs = useTickNowMs();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [lightbox, setLightbox] = useState<PhotoLightboxState>(null);

  const {
    data: issue,
    isPending,
    isError,
  } = useQuery({
    queryKey: qk.issueById(issueId),
    queryFn: () => fetchIssue(issueId),
  });

  const { data: membersRes } = useQuery({
    queryKey: qk.workspaceMembers(issue?.workspaceId ?? ""),
    queryFn: () => fetchWorkspaceMembers(issue!.workspaceId),
    enabled: Boolean(issue?.workspaceId),
  });

  const { applyRow, patchMut, deleteMut } = useIssueDetailMutations(issueId, projectId);

  if (isPending) {
    return (
      <div className="enterprise-card py-16">
        <EnterpriseLoadingState
          variant="minimal"
          message="Loading issue…"
          label="Loading issue detail"
        />
      </div>
    );
  }

  if (isError || !issue) {
    return (
      <div className="enterprise-card p-8 text-center text-sm text-[var(--enterprise-text-muted)]">
        Issue not found or unavailable.{" "}
        <Link
          href={`/projects/${projectId}/issues`}
          className="font-medium text-[var(--enterprise-primary)] hover:underline"
        >
          Back to issues
        </Link>
      </div>
    );
  }

  const viewerHref = viewerHrefForIssue(issue);

  return (
    <div className="space-y-3">
      <IssueDetailHeader
        issue={issue}
        projectId={projectId}
        viewerHref={viewerHref}
        overdue={isIssueOverdue(issue, nowMs)}
        patchPending={patchMut.isPending}
        onStatusChange={(status) => patchMut.mutate(status)}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />
      <IssueDetailBody
        issue={issue}
        projectId={projectId}
        viewerHref={viewerHref}
        nowMs={nowMs}
        onOpenPhoto={setLightbox}
      />
      <IssueEditSlideOver
        open={editOpen}
        issue={issue}
        onClose={() => setEditOpen(false)}
        members={membersRes?.members ?? []}
        onSaved={applyRow}
      />
      <DeleteProjectIssueConfirmDialog
        open={deleteOpen}
        title={issue.title}
        entityLabel="issue"
        isDeleting={deleteMut.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => deleteMut.mutate()}
      />
      <PhotoLightboxDialog lightbox={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
