"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Archive,
  ArrowDownAZ,
  ArrowUpAZ,
  Camera,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Columns3,
  Download,
  ExternalLink,
  FileText,
  LayoutGrid,
  LayoutList,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { EnterpriseMemberMultiPicker } from "@/components/enterprise/EnterpriseMemberMultiPicker";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import { AssigneeFilterSelect, StatusFilterChips } from "@/components/enterprise/issueListControls";
import { OmEmptyState } from "@/components/enterprise/OmEmptyState";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { PunchActivityTimeline } from "@/components/enterprise/PunchActivityTimeline";
import { PunchBoard } from "@/components/enterprise/PunchBoard";
import { PunchOverview } from "@/components/enterprise/PunchOverview";
import {
  applyPunchTemplate,
  bulkPatchPunchItems,
  completePunchPhotoUpload,
  createPunchItem,
  createPunchTemplate,
  deletePunchItem,
  fetchProject,
  fetchProjects,
  fetchProjectPunch,
  fetchPunchTemplates,
  fetchWorkspaceMembers,
  patchPunchItem,
  presignPunchPhotoUpload,
  presignReadPunchPhoto,
  punchExportCsvUrl,
  ProRequiredError,
  type PunchReferencePhotoRow,
  type PunchRow,
} from "@/lib/api-client";
import {
  PUNCH_PRIORITY_LABEL,
  PUNCH_STATUS_LABEL,
  PUNCH_STATUS_ORDER,
  punchStatusBadgeClass,
} from "@/lib/issueStatusStyle";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_SELECT,
  MOBILE_FIELD_TEXTAREA,
  MOBILE_FORM_SECTION,
} from "@/lib/mobileFormStyles";
import { OM_COMPACT_SELECT, OM_PAGE_CLASS } from "@/lib/omCompactStyles";
import { punchMatchesOverviewFilter, type PunchOverviewFilter } from "@/lib/punchOverviewStats";
import { qk } from "@/lib/queryKeys";
import { referencePhotoContentType } from "@/lib/referencePhotoMime";
import { useTickNowMs } from "@/lib/useTickNowMs";
import type { Project } from "@/types/projects";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";

const STATUSES = PUNCH_STATUS_ORDER;
type PunchStatus = (typeof STATUSES)[number];
type StatusChip = "ALL" | PunchStatus;
type ViewMode = "list" | "board";

const PRIORITIES = ["P1", "P2", "P3"] as const;

const PUNCH_STATUS_FILTER_DEFS: { key: StatusChip; label: string; Icon: LucideIcon }[] = [
  { key: "ALL", label: "All", Icon: LayoutGrid },
  { key: "OPEN", label: "Open", Icon: CircleDot },
  { key: "IN_PROGRESS", label: "In progress", Icon: Activity },
  { key: "READY_FOR_GC", label: "Ready for GC", Icon: CheckCircle2 },
  { key: "CLOSED", label: "Closed", Icon: Archive },
];

const FILTER_LABEL_CLASS =
  "mb-0.5 flex items-center gap-1 text-xs font-medium text-[var(--enterprise-text-muted)]";

function countPunchTemplateItems(itemsJson: unknown): number {
  if (Array.isArray(itemsJson)) return itemsJson.length;
  if (typeof itemsJson === "string") {
    try {
      const p = JSON.parse(itemsJson) as unknown;
      return Array.isArray(p) ? p.length : 0;
    } catch {
      return 0;
    }
  }
  if (
    itemsJson &&
    typeof itemsJson === "object" &&
    Array.isArray((itemsJson as { items?: unknown }).items)
  ) {
    return (itemsJson as { items: unknown[] }).items.length;
  }
  return 0;
}

type SortCol =
  | "punchNumber"
  | "title"
  | "location"
  | "assignee"
  | "dueDate"
  | "status"
  | "priority";
type SortDir = "asc" | "desc";

function formatTableDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function assigneeLabel(p: PunchRow): string {
  const names =
    p.assignees?.map((a) => a.name?.trim()).filter((x): x is string => Boolean(x)) ?? [];
  if (names.length > 0) return names.join(", ");
  return p.assignee?.name?.trim() || "—";
}

function punchAssigneeIds(p: PunchRow): string[] {
  const ids = new Set<string>();
  if (p.assigneeId) ids.add(p.assigneeId);
  for (const a of p.assignees ?? []) {
    if (a.id) ids.add(a.id);
  }
  return [...ids];
}

type SheetPickRow = {
  fileId: string;
  fileName: string;
  fileVersionId: string;
  version: number;
  label: string;
};

function sheetRowsForProject(project: Project | null): SheetPickRow[] {
  if (!project) return [];
  const out: SheetPickRow[] = [];
  for (const f of project.files) {
    for (const v of f.versions) {
      out.push({
        fileId: f.id,
        fileName: f.name,
        fileVersionId: v.id,
        version: v.version,
        label: `${f.name} (v${v.version})`,
      });
    }
  }
  return out.sort((a, b) => a.fileName.localeCompare(b.fileName) || b.version - a.version);
}

function PunchPhotoThumb({
  projectId,
  punchId,
  photo,
}: {
  projectId: string;
  punchId: string;
  photo: PunchReferencePhotoRow;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let cancelled = false;
    presignReadPunchPhoto(projectId, punchId, photo.id)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setErr(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, punchId, photo.id]);
  if (err || !url) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)] text-[10px] text-[var(--enterprise-text-muted)]">
        {err ? "!" : <Loader2 className="h-4 w-4 animate-spin opacity-50" />}
      </div>
    );
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL */}
      <img
        src={url}
        alt=""
        className="h-16 w-16 shrink-0 rounded-md border border-[var(--enterprise-border)] object-cover"
      />
    </>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onToggle,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1 text-[11px] font-normal uppercase tracking-wide text-[var(--enterprise-text)] hover:text-[var(--enterprise-text)]"
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ArrowUpAZ className="h-3.5 w-3.5 text-[var(--enterprise-primary)]" />
        ) : (
          <ArrowDownAZ className="h-3.5 w-3.5 text-[var(--enterprise-primary)]" />
        )
      ) : (
        <span className="inline-block w-3.5" />
      )}
    </button>
  );
}

// fallow-ignore-next-line complexity
export function ProjectPunchClient({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusPunchId = searchParams.get("punch")?.trim() || null;
  const newModalTitleId = useId();
  const { me } = useEnterpriseWorkspace();
  const currentUserId = me?.user.id;
  const nowMs = useTickNowMs();

  const [search, setSearch] = useState("");
  const [overviewFilter, setOverviewFilter] = useState<PunchOverviewFilter>("ALL");
  const [filterStatus, setFilterStatus] = useState<StatusChip>("ALL");
  const [filterAssignee, setFilterAssignee] = useState<string>("ALL");
  const [filterLocation, setFilterLocation] = useState<string>("ALL");
  const [filterPriority, setFilterPriority] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortCol, setSortCol] = useState<SortCol>("punchNumber");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [slideOpen, setSlideOpen] = useState(false);
  const [activePunchId, setActivePunchId] = useState<string | null>(null);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [manageTemplatesOpen, setManageTemplatesOpen] = useState(false);
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newTrade, setNewTrade] = useState("General");
  const [newAssignees, setNewAssignees] = useState<string[]>([]);
  const [newPriority, setNewPriority] = useState("P2");
  const [newDue, setNewDue] = useState("");
  const [newMsg, setNewMsg] = useState<string | null>(null);

  const [tplName, setTplName] = useState("");
  const [tplScope, setTplScope] = useState<"PROJECT" | "WORKSPACE">("PROJECT");
  const [tplDraftLines, setTplDraftLines] = useState<
    { title: string; location: string; trade: string }[]
  >([{ title: "", location: "", trade: "General" }]);

  const { data: items = [], isPending } = useQuery({
    queryKey: qk.projectPunch(projectId),
    queryFn: () => fetchProjectPunch(projectId),
  });
  const { data: project } = useQuery({
    queryKey: qk.project(projectId),
    queryFn: () => fetchProject(projectId),
  });
  const workspaceId = project?.workspaceId ?? "";
  const { data: membersResp } = useQuery({
    queryKey: qk.workspaceMembers(workspaceId || "none"),
    queryFn: () => fetchWorkspaceMembers(workspaceId),
    enabled: workspaceId.length > 0,
  });
  const members = membersResp?.members ?? [];
  const { data: templates = [] } = useQuery({
    queryKey: qk.projectPunchTemplates(projectId),
    queryFn: () => fetchPunchTemplates(projectId),
  });
  const { data: projects = [] } = useQuery({
    queryKey: qk.projects(workspaceId || "none"),
    queryFn: () => fetchProjects(workspaceId),
    enabled: workspaceId.length > 0,
  });
  const currentProject = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  );

  const locationOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of items) {
      const t = r.location?.trim();
      if (t) s.add(t);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const effectiveOverviewFilter: PunchOverviewFilter =
    overviewFilter === "MINE" && !currentUserId ? "ALL" : overviewFilter;

  const onOverviewFilterChange = (key: PunchOverviewFilter) => {
    setOverviewFilter(key);
    if (
      key === "OPEN" ||
      key === "IN_PROGRESS" ||
      key === "READY_FOR_GC" ||
      key === "CLOSED" ||
      key === "ALL"
    ) {
      setFilterStatus(key);
    } else {
      setFilterStatus("ALL");
    }
  };

  const onStatusChipChange = (key: StatusChip) => {
    setFilterStatus(key);
    setOverviewFilter(key);
  };

  const clearFilters = () => {
    setOverviewFilter("ALL");
    setFilterStatus("ALL");
    setFilterAssignee("ALL");
    setFilterLocation("ALL");
    setFilterPriority("ALL");
    setSearch("");
  };

  const filtersActive =
    overviewFilter !== "ALL" ||
    filterStatus !== "ALL" ||
    filterAssignee !== "ALL" ||
    filterLocation !== "ALL" ||
    filterPriority !== "ALL" ||
    Boolean(search.trim());

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = items.filter(
      // fallow-ignore-next-line complexity
      (r) => {
        if (!punchMatchesOverviewFilter(r, effectiveOverviewFilter, nowMs, currentUserId)) {
          return false;
        }
        if (filterStatus !== "ALL" && r.status !== filterStatus) return false;
        if (filterPriority !== "ALL" && r.priority !== filterPriority) return false;
        if (filterLocation !== "ALL" && r.location !== filterLocation) return false;
        const assigneeIds = punchAssigneeIds(r);
        if (filterAssignee === "UNASSIGNED") {
          if (assigneeIds.length > 0) return false;
        } else if (filterAssignee !== "ALL" && !assigneeIds.includes(filterAssignee)) return false;
        if (q) {
          const blob = [
            r.title,
            r.location,
            r.trade,
            r.notes ?? "",
            r.assignee?.name ?? "",
            String(r.punchNumber),
          ]
            .join(" ")
            .toLowerCase();
          if (!blob.includes(q)) return false;
        }
        return true;
      },
    );

    const cmp = (a: PunchRow, b: PunchRow): number => {
      let va: string | number = 0;
      let vb: string | number = 0;
      switch (sortCol) {
        case "punchNumber":
          va = a.punchNumber;
          vb = b.punchNumber;
          break;
        case "title":
          va = a.title.toLowerCase();
          vb = b.title.toLowerCase();
          break;
        case "location":
          va = a.location.toLowerCase();
          vb = b.location.toLowerCase();
          break;
        case "assignee":
          va = assigneeLabel(a).toLowerCase();
          vb = assigneeLabel(b).toLowerCase();
          break;
        case "dueDate":
          va = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          vb = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          break;
        case "status":
          va = a.status;
          vb = b.status;
          break;
        case "priority":
          va = a.priority;
          vb = b.priority;
          break;
        default:
          break;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    };
    rows = [...rows].sort(cmp);
    return rows;
  }, [
    items,
    search,
    effectiveOverviewFilter,
    nowMs,
    currentUserId,
    filterStatus,
    filterAssignee,
    filterLocation,
    filterPriority,
    sortCol,
    sortDir,
  ]);

  const activePunch = useMemo(
    () => items.find((r) => r.id === activePunchId) ?? null,
    [items, activePunchId],
  );

  const setPunchQuery = useCallback(
    (id: string | null) => {
      const p = new URLSearchParams(searchParams.toString());
      if (id) p.set("punch", id);
      else p.delete("punch");
      const q = p.toString();
      router.replace(q ? `/projects/${projectId}/punch?${q}` : `/projects/${projectId}/punch`, {
        scroll: false,
      });
    },
    [projectId, router, searchParams],
  );

  useEffect(() => {
    if (!focusPunchId || isPending) return;
    const hit = items.find((r) => r.id === focusPunchId);
    if (hit) {
      setActivePunchId(focusPunchId);
      setSlideOpen(true);
    }
  }, [focusPunchId, isPending, items]);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir(col === "punchNumber" || col === "dueDate" ? "desc" : "asc");
    }
  };

  const patchMut = useMutation({
    mutationFn: (vars: { id: string; body: Parameters<typeof patchPunchItem>[2] }) =>
      patchPunchItem(projectId, vars.id, vars.body),
    onSuccess: (row) => {
      qc.setQueryData<PunchRow[]>(qk.projectPunch(projectId), (old) =>
        (old ?? []).map((r) => (r.id === row.id ? row : r)),
      );
    },
    onError: (e: Error) => toast.error(e.message || "Update failed."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePunchItem(projectId, id),
    onSuccess: async (_, id) => {
      await qc.invalidateQueries({ queryKey: qk.projectPunch(projectId) });
      setSelectedIds((s) => s.filter((x) => x !== id));
      if (activePunchId === id) {
        setSlideOpen(false);
        setActivePunchId(null);
        setPunchQuery(null);
      }
      toast.success("Item deleted.");
    },
    onError: (e: Error) => toast.error(e.message || "Delete failed."),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createPunchItem(projectId, {
        title: newTitle.trim(),
        location: newLocation.trim(),
        trade: newTrade.trim() || "General",
        assigneeIds: newAssignees,
        assigneeId: newAssignees[0] || null,
        dueDateYmd: newDue || null,
        priority: newPriority,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.projectPunch(projectId) });
      setNewModalOpen(false);
      setNewTitle("");
      setNewLocation("");
      setNewTrade("General");
      setNewAssignees([]);
      setNewPriority("P2");
      setNewDue("");
      setNewMsg(null);
      toast.success("Punch item created.");
    },
    onError: (e: Error) => {
      if (e instanceof ProRequiredError) setNewMsg("Pro subscription required.");
      else setNewMsg(e.message);
    },
  });

  const applyTplMut = useMutation({
    mutationFn: (templateId: string) => applyPunchTemplate(projectId, templateId),
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: qk.projectPunch(projectId) });
      setChecklistModalOpen(false);
      setManageTemplatesOpen(false);
      const n = data.created;
      toast.success(
        n === 1
          ? "Added 1 punch item from the checklist."
          : `Added ${n} punch items from the checklist.`,
      );
    },
    onError: (e: Error) => toast.error(e.message || "Could not apply checklist."),
  });

  const createTplMut = useMutation({
    mutationFn: () => {
      const items = tplDraftLines
        .filter((r) => r.title.trim() || r.location.trim())
        .map((r) => ({
          title: r.title.trim() || "Punch item",
          location: r.location.trim() || "TBD",
          trade: r.trade.trim() || "General",
        }));
      return createPunchTemplate(projectId, {
        name: tplName.trim(),
        scope: tplScope,
        items,
      });
    },
    onSuccess: async () => {
      setTplName("");
      setTplScope("PROJECT");
      setTplDraftLines([{ title: "", location: "", trade: "General" }]);
      await qc.invalidateQueries({ queryKey: qk.projectPunchTemplates(projectId) });
      toast.success(
        "Checklist saved. You can add it to this project anytime from “Add from checklist”.",
      );
    },
    onError: (e: Error) => toast.error(e.message || "Could not save checklist."),
  });

  const bulkMut = useMutation({
    mutationFn: (body: { ids: string[]; assigneeId?: string | null; status?: string }) =>
      bulkPatchPunchItems(projectId, body),
    onSuccess: async () => {
      setSelectedIds([]);
      await qc.invalidateQueries({ queryKey: qk.projectPunch(projectId) });
      toast.success("Bulk update applied.");
    },
    onError: (e: Error) => toast.error(e.message || "Bulk update failed."),
  });

  const uploadPhotosForPunch = useCallback(
    async (punchId: string, file: File) => {
      const ct = referencePhotoContentType(file);
      const { uploadUrl, key } = await presignPunchPhotoUpload(projectId, punchId, {
        fileName: file.name || "photo.jpg",
        contentType: ct,
        sizeBytes: file.size,
      });
      const put = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": ct },
      });
      if (!put.ok) throw new Error("Could not upload image to storage.");
      return completePunchPhotoUpload(projectId, punchId, {
        key,
        fileName: file.name || "photo.jpg",
        contentType: ct,
        sizeBytes: file.size,
      });
    },
    [projectId],
  );

  const photoMut = useMutation({
    mutationFn: async ({ punchId, file }: { punchId: string; file: File }) => {
      const row = await uploadPhotosForPunch(punchId, file);
      return row;
    },
    onSuccess: (row) => {
      qc.setQueryData<PunchRow[]>(qk.projectPunch(projectId), (old) =>
        (old ?? []).map((r) => (r.id === row.id ? row : r)),
      );
      toast.success("Photo added.");
    },
    onError: (e: Error) => toast.error(e.message || "Photo upload failed."),
  });

  const removePhotoMut = useMutation({
    mutationFn: ({
      punchId,
      nextPhotos,
    }: {
      punchId: string;
      nextPhotos: PunchReferencePhotoRow[];
    }) => patchPunchItem(projectId, punchId, { referencePhotos: nextPhotos }),
    onSuccess: (row) => {
      qc.setQueryData<PunchRow[]>(qk.projectPunch(projectId), (old) =>
        (old ?? []).map((r) => (r.id === row.id ? row : r)),
      );
      toast.success("Photo removed.");
    },
  });

  const openRow = (id: string) => {
    setActivePunchId(id);
    setSlideOpen(true);
    setPunchQuery(id);
  };

  const closeSlide = () => {
    setSlideOpen(false);
    setActivePunchId(null);
    setPunchQuery(null);
  };

  const allSelected =
    filteredSorted.length > 0 && filteredSorted.every((r) => selectedIds.includes(r.id));
  const toggleAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(filteredSorted.map((r) => r.id));
  };

  return (
    <div className={OM_PAGE_CLASS}>
      <OmSubPageHeader
        icon={ClipboardList}
        title="Punch list"
        description="Track open items, photos, and closeouts."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={punchExportCsvUrl(projectId)}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 text-sm font-semibold text-[var(--enterprise-text)] shadow-sm transition hover:bg-[var(--enterprise-hover-surface)]"
            >
              <Download className="h-4 w-4" />
              Export
            </a>
            <EnterpriseButton
              size="sm"
              variant="secondary"
              onClick={() => setChecklistModalOpen(true)}
            >
              <FileText className="h-4 w-4" />
              From checklist
            </EnterpriseButton>
            <EnterpriseButton size="sm" onClick={() => setNewModalOpen(true)}>
              <Plus className="h-4 w-4" />
              New item
            </EnterpriseButton>
          </div>
        }
      />

      {items.length > 0 ? (
        <PunchOverview
          rows={items}
          filter={overviewFilter}
          onFilterChange={onOverviewFilterChange}
          currentUserId={currentUserId}
        />
      ) : null}

      {/* Bulk bar OR filters */}
      {selectedIds.length > 0 ? (
        <div
          className="sticky top-0 z-20 flex flex-col gap-3 rounded-xl border border-[var(--enterprise-primary)]/20 bg-[var(--enterprise-primary)]/10 px-4 py-3 shadow-[var(--enterprise-shadow-xs)] sm:flex-row sm:items-center sm:justify-between"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
        >
          <p className="text-sm font-semibold text-[var(--enterprise-primary)]">
            {selectedIds.length} item{selectedIds.length === 1 ? "" : "s"} selected
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <BulkAssignSelect
              members={members}
              onApply={(userId) => bulkMut.mutate({ ids: selectedIds, assigneeId: userId })}
            />
            <BulkStatusSelect onApply={(st) => bulkMut.mutate({ ids: selectedIds, status: st })} />
            <EnterpriseButton
              size="sm"
              variant="danger"
              onClick={() => {
                if (
                  !window.confirm(
                    `Delete ${selectedIds.length} punch item(s)? This cannot be undone.`,
                  )
                )
                  return;
                void (async () => {
                  for (const id of selectedIds) {
                    try {
                      await deletePunchItem(projectId, id);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Delete failed");
                      break;
                    }
                  }
                  await qc.invalidateQueries({ queryKey: qk.projectPunch(projectId) });
                  setSelectedIds([]);
                  toast.success("Selected items removed.");
                })();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </EnterpriseButton>
            <button
              type="button"
              className="text-xs font-semibold text-[var(--enterprise-primary)] underline"
              onClick={() => setSelectedIds([])}
            >
              Clear selection
            </button>
          </div>
        </div>
      ) : items.length > 0 ? (
        <section className="enterprise-card flex flex-col gap-2 p-3 sm:p-4">
          <StatusFilterChips
            defs={PUNCH_STATUS_FILTER_DEFS}
            value={filterStatus}
            onChange={onStatusChipChange}
            filtersActive={filtersActive}
            onReset={clearFilters}
          />
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[11rem] flex-1 sm:max-w-[16rem]">
              <span className={FILTER_LABEL_CLASS}>
                <Search className="h-3.5 w-3.5" aria-hidden />
                Search
              </span>
              <input
                type="search"
                placeholder="Title, location, assignee…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={OM_COMPACT_SELECT}
              />
            </label>
            <AssigneeFilterSelect
              id="punch-assignee-filter"
              value={filterAssignee}
              onChange={setFilterAssignee}
              members={members}
            />
            <label className="min-w-[8rem]">
              <span className={FILTER_LABEL_CLASS}>Location</span>
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className={OM_COMPACT_SELECT}
              >
                <option value="ALL">All locations</option>
                {locationOptions.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-[7rem]">
              <span className={FILTER_LABEL_CLASS}>Priority</span>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className={OM_COMPACT_SELECT}
              >
                <option value="ALL">All priorities</option>
                {PRIORITIES.map((pr) => (
                  <option key={pr} value={pr}>
                    {PUNCH_PRIORITY_LABEL[pr] ?? pr}
                  </option>
                ))}
              </select>
            </label>
            <div
              className="inline-flex rounded-lg border border-[var(--enterprise-border)] p-0.5"
              role="group"
              aria-label="View mode"
            >
              <button
                type="button"
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
                className={`inline-flex min-h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold ${
                  viewMode === "list"
                    ? "bg-[var(--enterprise-primary)] text-white"
                    : "text-[var(--enterprise-text-muted)]"
                }`}
              >
                <LayoutList className="h-3.5 w-3.5" aria-hidden />
                List
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "board"}
                onClick={() => setViewMode("board")}
                className={`inline-flex min-h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold ${
                  viewMode === "board"
                    ? "bg-[var(--enterprise-primary)] text-white"
                    : "text-[var(--enterprise-text-muted)]"
                }`}
              >
                <Columns3 className="h-3.5 w-3.5" aria-hidden />
                Board
              </button>
            </div>
            <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:items-center">
              <EnterpriseButton
                size="sm"
                variant="secondary"
                onClick={() => setChecklistModalOpen(true)}
              >
                <FileText className="h-4 w-4 shrink-0" />
                Add from checklist
              </EnterpriseButton>
              <EnterpriseButton
                size="sm"
                variant="ghost"
                onClick={() => setManageTemplatesOpen(true)}
              >
                Edit checklists
              </EnterpriseButton>
            </div>
          </div>
        </section>
      ) : null}

      {isPending ? (
        <div className="py-16">
          <EnterpriseLoadingState variant="minimal" message="Loading punch list…" label="Loading" />
        </div>
      ) : items.length === 0 ? (
        <OmEmptyState
          icon={ClipboardList}
          title="No punch items yet"
          description="Create punch items for closeout deficiencies, or add a reusable checklist."
          action={
            <EnterpriseButton size="sm" onClick={() => setNewModalOpen(true)}>
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              New item
            </EnterpriseButton>
          }
        />
      ) : filteredSorted.length === 0 ? (
        <OmEmptyState
          icon={ClipboardList}
          title="No items match"
          description="Try clearing filters or searching with different terms."
          action={
            <EnterpriseButton size="sm" variant="secondary" onClick={clearFilters}>
              Reset filters
            </EnterpriseButton>
          }
        />
      ) : viewMode === "board" ? (
        <div className="p-1 sm:p-0">
          <PunchBoard
            rows={filteredSorted}
            movingId={patchMut.isPending ? patchMut.variables?.id : null}
            onOpen={(p) => openRow(p.id)}
            onMove={(id, status) => patchMut.mutate({ id, body: { status } })}
          />
        </div>
      ) : (
        <>
          <ul className="space-y-2 lg:hidden" aria-label="Punch list">
            {filteredSorted.map((p) => {
              const active = activePunchId === p.id && slideOpen;
              return (
                <li key={`m-${p.id}`}>
                  <button
                    type="button"
                    onClick={() => openRow(p.id)}
                    className={`flex min-h-10 w-full items-center gap-3 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-left shadow-[var(--enterprise-shadow-xs)] transition-all duration-150 active:scale-[0.99] active:bg-[var(--enterprise-hover-surface)]/60 ${
                      active
                        ? "border-[var(--enterprise-primary)]/35 ring-2 ring-[var(--enterprise-primary)]/15"
                        : ""
                    }`}
                  >
                    <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-[var(--enterprise-primary)]">
                      #{p.punchNumber}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-[var(--enterprise-text)]">
                        {p.title}
                      </p>
                      <p className="truncate text-sm text-[var(--enterprise-text-muted)]">
                        {p.location} · {assigneeLabel(p)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${punchStatusBadgeClass(p.status)}`}
                    >
                      {PUNCH_STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div
            className="hidden lg:block lg:-mx-0 lg:overflow-x-auto"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div className="inline-block min-w-full align-middle">
              <table className="w-full min-w-[760px] border-collapse rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)] md:min-w-[920px]">
                <thead>
                  <tr className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]">
                    <th className="w-10 px-2 py-2 text-left text-[var(--enterprise-text)]">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[var(--enterprise-border)]"
                        checked={allSelected}
                        onChange={toggleAll}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-3 py-2 text-left">
                      <SortHeader
                        label="#"
                        active={sortCol === "punchNumber"}
                        dir={sortDir}
                        onToggle={() => toggleSort("punchNumber")}
                      />
                    </th>
                    <th className="min-w-[140px] px-3 py-2 text-left">
                      <SortHeader
                        label="Title"
                        active={sortCol === "title"}
                        dir={sortDir}
                        onToggle={() => toggleSort("title")}
                      />
                    </th>
                    <th className="min-w-[120px] px-3 py-2 text-left">
                      <SortHeader
                        label="Location"
                        active={sortCol === "location"}
                        dir={sortDir}
                        onToggle={() => toggleSort("location")}
                      />
                    </th>
                    <th className="min-w-[140px] px-3 py-2 text-left">
                      <SortHeader
                        label="Assignee"
                        active={sortCol === "assignee"}
                        dir={sortDir}
                        onToggle={() => toggleSort("assignee")}
                      />
                    </th>
                    <th className="min-w-[100px] px-3 py-2 text-left">
                      <SortHeader
                        label="Due"
                        active={sortCol === "dueDate"}
                        dir={sortDir}
                        onToggle={() => toggleSort("dueDate")}
                      />
                    </th>
                    <th className="min-w-[120px] px-3 py-2 text-left">
                      <SortHeader
                        label="Status"
                        active={sortCol === "status"}
                        dir={sortDir}
                        onToggle={() => toggleSort("status")}
                      />
                    </th>
                    <th className="min-w-[100px] px-3 py-2 text-left">
                      <SortHeader
                        label="Priority"
                        active={sortCol === "priority"}
                        dir={sortDir}
                        onToggle={() => toggleSort("priority")}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSorted.map((p) => {
                    const sel = selectedIds.includes(p.id);
                    const active = activePunchId === p.id && slideOpen;
                    const rowHi = sel || active;
                    return (
                      <tr
                        key={p.id}
                        id={`punch-row-${p.id}`}
                        onClick={() => openRow(p.id)}
                        className={`h-11 cursor-pointer border-b border-[var(--enterprise-border)] text-sm transition-colors last:border-b-0 ${
                          rowHi
                            ? "border-l-4 border-l-[var(--enterprise-primary)] bg-[var(--enterprise-primary)]/10"
                            : "hover:bg-[var(--enterprise-hover-surface)]"
                        }`}
                      >
                        <td className="px-2 py-0" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-[var(--enterprise-border)]"
                            checked={sel}
                            onChange={(e) => {
                              e.stopPropagation();
                              setSelectedIds((ids) =>
                                e.target.checked ? [...ids, p.id] : ids.filter((x) => x !== p.id),
                              );
                            }}
                            aria-label={`Select #${p.punchNumber}`}
                          />
                        </td>
                        <td className="px-3 font-mono text-xs font-semibold text-[var(--enterprise-primary)]">
                          {p.punchNumber}
                        </td>
                        <td className="max-w-[220px] truncate px-3 font-medium text-[var(--enterprise-text)]">
                          {p.title}
                        </td>
                        <td className="max-w-[160px] truncate px-3 text-[var(--enterprise-text)]">
                          {p.location}
                        </td>
                        <td className="px-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <AssigneeAvatar member={p.assignee} />
                            <span className="truncate text-[var(--enterprise-text)]/85">
                              {assigneeLabel(p)}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 text-[var(--enterprise-text)]">
                          {formatTableDate(p.dueDate)}
                        </td>
                        <td className="px-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${punchStatusBadgeClass(p.status)}`}
                          >
                            {PUNCH_STATUS_LABEL[p.status] ?? p.status}
                          </span>
                        </td>
                        <td className="px-3 text-[var(--enterprise-text)]">
                          {PUNCH_PRIORITY_LABEL[p.priority] ?? p.priority}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      <button
        type="button"
        onClick={() => setChecklistModalOpen(true)}
        className="fixed z-40 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--enterprise-primary)]/25 bg-[var(--enterprise-surface)] text-[var(--enterprise-primary)] shadow-lg transition-all duration-150 active:scale-95 lg:hidden"
        style={{
          right: "max(1rem, env(safe-area-inset-right, 0px))",
          bottom: "calc(var(--enterprise-bottomnav-offset, 4.5rem) + 4.25rem)",
        }}
        aria-label="Add from checklist"
      >
        <FileText className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </button>

      <PunchDetailSlider
        open={slideOpen && !!activePunch}
        punch={activePunch}
        projectId={projectId}
        members={members}
        currentProject={currentProject}
        onClose={closeSlide}
        patchMut={patchMut}
        photoMut={photoMut}
        removePhotoMut={removePhotoMut}
        deleteMut={deleteMut}
      />

      {/* New item — slide-over */}
      <EnterpriseSlideOver
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        overlayZClass="z-[102]"
        panelVariant="floating"
        panelMaxWidthClass="max-w-[min(calc(100dvw-16px),560px)]"
        panelChromeClassName="border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-floating)]"
        closeOnBackdrop={false}
        closeOnEscape={false}
        ariaLabelledBy={newModalTitleId}
        form={{
          onSubmit: (e) => {
            e.preventDefault();
            if (!newTitle.trim() || !newLocation.trim()) {
              setNewMsg("Title and location are required.");
              return;
            }
            createMut.mutate();
          },
        }}
        header={
          <div>
            <h2
              id={newModalTitleId}
              className="text-lg font-semibold text-[var(--enterprise-text)]"
            >
              New punch list item
            </h2>
            <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
              Required fields: title and location.
            </p>
          </div>
        }
        footer={
          <>
            <EnterpriseButton
              type="button"
              variant="secondary"
              onClick={() => setNewModalOpen(false)}
            >
              Cancel
            </EnterpriseButton>
            <EnterpriseButton type="submit" loading={createMut.isPending}>
              {createMut.isPending ? "Creating…" : "Create Item"}
            </EnterpriseButton>
          </>
        }
        bodyClassName="space-y-4 px-5 py-5"
        footerClassName="border-t border-[var(--enterprise-border)] px-5 py-3"
      >
        <div className={MOBILE_FORM_SECTION}>
          <div>
            <label htmlFor="punch-new-title" className={MOBILE_FIELD_LABEL}>
              Title (required)
            </label>
            <input
              id="punch-new-title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className={MOBILE_FIELD_INPUT}
              required
            />
          </div>
          <div>
            <label htmlFor="punch-new-location" className={MOBILE_FIELD_LABEL}>
              Location
            </label>
            <input
              id="punch-new-location"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              className={MOBILE_FIELD_INPUT}
              required
            />
          </div>
          <div>
            <label htmlFor="punch-new-trade" className={MOBILE_FIELD_LABEL}>
              Trade
            </label>
            <input
              id="punch-new-trade"
              value={newTrade}
              onChange={(e) => setNewTrade(e.target.value)}
              className={MOBILE_FIELD_INPUT}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className={MOBILE_FIELD_LABEL}>Assignees</p>
              <EnterpriseMemberMultiPicker
                members={members}
                value={newAssignees}
                onChange={setNewAssignees}
              />
            </div>
            <div>
              <label htmlFor="punch-new-priority" className={MOBILE_FIELD_LABEL}>
                Priority
              </label>
              <select
                id="punch-new-priority"
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                className={MOBILE_FIELD_SELECT}
              >
                {PRIORITIES.map((pr) => (
                  <option key={pr} value={pr}>
                    {PUNCH_PRIORITY_LABEL[pr] ?? pr}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="punch-new-due" className={MOBILE_FIELD_LABEL}>
              Due date
            </label>
            <input
              id="punch-new-due"
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              className={MOBILE_FIELD_INPUT}
            />
          </div>
        </div>
        {newMsg ? (
          <p className="text-sm text-[var(--enterprise-semantic-danger-text)]">{newMsg}</p>
        ) : null}
      </EnterpriseSlideOver>

      {/* Add from checklist — slide-over */}
      <EnterpriseSlideOver
        open={checklistModalOpen}
        onClose={() => setChecklistModalOpen(false)}
        overlayZClass="z-[102]"
        panelVariant="floating"
        panelMaxWidthClass="max-w-[min(calc(100dvw-16px),560px)]"
        panelChromeClassName="border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-floating)]"
        closeOnBackdrop={false}
        closeOnEscape={false}
        ariaLabelledBy="punch-checklist-slide-title"
        header={
          <div>
            <h2
              id="punch-checklist-slide-title"
              className="text-lg font-semibold text-[var(--enterprise-text)]"
            >
              Add from a checklist
            </h2>
            <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
              Each line becomes a new punch item (you can edit afterward).
            </p>
          </div>
        }
        footer={
          <EnterpriseButton
            type="button"
            variant="secondary"
            fullWidth
            onClick={() => {
              setChecklistModalOpen(false);
              setManageTemplatesOpen(true);
            }}
          >
            Create or edit checklists
          </EnterpriseButton>
        }
        bodyClassName="space-y-4 px-5 py-5"
        footerClassName="border-t border-[var(--enterprise-border)] px-5 py-3"
      >
        {templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] p-6 text-center">
            <p className="mb-3 text-sm text-[var(--enterprise-text-muted)]">
              You don&apos;t have any saved checklists yet.
            </p>
            <EnterpriseButton
              size="sm"
              onClick={() => {
                setChecklistModalOpen(false);
                setManageTemplatesOpen(true);
              }}
            >
              Create a checklist
            </EnterpriseButton>
          </div>
        ) : (
          <ul className="space-y-2">
            {templates.map((t) => {
              const n = countPunchTemplateItems(t.itemsJson);
              return (
                <li
                  key={t.id}
                  className="flex flex-col gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--enterprise-text)]">{t.name}</p>
                    <p className="text-xs text-[var(--enterprise-text-muted)]">
                      {n === 0 ? "No lines (cannot add)" : `${n} punch line${n === 1 ? "" : "s"}`}
                      {t.projectId ? " · This project" : " · All projects"}
                    </p>
                  </div>
                  <EnterpriseButton
                    size="sm"
                    disabled={applyTplMut.isPending || n === 0}
                    loading={applyTplMut.isPending}
                    onClick={() => applyTplMut.mutate(t.id)}
                  >
                    {applyTplMut.isPending ? "Adding…" : "Add to punch list"}
                  </EnterpriseButton>
                </li>
              );
            })}
          </ul>
        )}
      </EnterpriseSlideOver>

      {/* Reusable checklists (templates) — slide-over */}
      <EnterpriseSlideOver
        open={manageTemplatesOpen}
        onClose={() => setManageTemplatesOpen(false)}
        overlayZClass="z-[102]"
        panelVariant="floating"
        panelMaxWidthClass="max-w-[min(calc(100dvw-16px),720px)]"
        panelChromeClassName="border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-floating)]"
        closeOnBackdrop={false}
        closeOnEscape={false}
        ariaLabelledBy="punch-manage-checklists-slide-title"
        header={
          <div>
            <h2
              id="punch-manage-checklists-slide-title"
              className="text-lg font-semibold text-[var(--enterprise-text)]"
            >
              Reusable checklists
            </h2>
            <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
              Saved lists you can apply to this punch list anytime.
            </p>
          </div>
        }
        footer={
          <>
            <EnterpriseButton
              type="button"
              variant="secondary"
              onClick={() => setManageTemplatesOpen(false)}
            >
              Cancel
            </EnterpriseButton>
            <EnterpriseButton
              type="button"
              disabled={!tplName.trim()}
              loading={createTplMut.isPending}
              onClick={() => {
                if (!tplName.trim()) return;
                if (!tplDraftLines.some((r) => r.title.trim() || r.location.trim())) {
                  toast.error("Add at least one line with a title or a location.");
                  return;
                }
                createTplMut.mutate();
              }}
            >
              {createTplMut.isPending ? "Saving…" : "Save checklist"}
            </EnterpriseButton>
          </>
        }
        bodyClassName="space-y-4 px-5 py-5"
        footerClassName="border-t border-[var(--enterprise-border)] px-5 py-3"
      >
        <ul className="max-h-40 space-y-1 overflow-auto rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] p-2">
          {templates.length === 0 ? (
            <li className="text-xs text-[var(--enterprise-text-muted)]">
              None yet — add one below.
            </li>
          ) : (
            templates.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 text-sm text-[var(--enterprise-text)]"
              >
                <span className="min-w-0 truncate">{t.name}</span>
                <button
                  type="button"
                  className="shrink-0 text-xs font-semibold text-[var(--enterprise-primary)]"
                  onClick={() => applyTplMut.mutate(t.id)}
                >
                  Add to project
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="text-xs font-semibold text-[var(--enterprise-text-muted)]">New checklist</p>
        <div>
          <label htmlFor="punch-tpl-name" className={MOBILE_FIELD_LABEL}>
            Name
          </label>
          <input
            id="punch-tpl-name"
            value={tplName}
            onChange={(e) => setTplName(e.target.value)}
            placeholder="e.g. Level 1 walkthrough"
            className={MOBILE_FIELD_INPUT}
          />
        </div>
        <fieldset className="text-xs text-[var(--enterprise-text-muted)]">
          <legend className="mb-1 font-semibold">Where to save</legend>
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="tplScope"
                checked={tplScope === "PROJECT"}
                onChange={() => setTplScope("PROJECT")}
              />
              This project only
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="tplScope"
                checked={tplScope === "WORKSPACE"}
                onChange={() => setTplScope("WORKSPACE")}
              />
              All projects in workspace
            </label>
          </div>
        </fieldset>
        <p className="text-xs text-[var(--enterprise-text-muted)]">
          Lines to add when you use this checklist (title or location required per row).
        </p>
        <div className="overflow-x-auto rounded-lg border border-[var(--enterprise-border)]">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                <th className="px-2 py-2">What to fix</th>
                <th className="px-2 py-2">Where</th>
                <th className="w-28 px-2 py-2">Trade</th>
                <th className="w-10 px-1 py-2" />
              </tr>
            </thead>
            <tbody>
              {tplDraftLines.map((row, i) => (
                <tr key={i} className="border-b border-[var(--enterprise-border)]/60 last:border-0">
                  <td className="p-1">
                    <input
                      value={row.title}
                      onChange={(e) => {
                        const v = e.target.value;
                        setTplDraftLines((lines) =>
                          lines.map((l, j) => (j === i ? { ...l, title: v } : l)),
                        );
                      }}
                      placeholder="e.g. Patch drywall"
                      className="w-full rounded border border-transparent bg-[var(--enterprise-surface)] px-2 py-1.5 text-sm hover:border-[var(--enterprise-border)] focus:border-[var(--enterprise-primary)] focus:outline-none"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      value={row.location}
                      onChange={(e) => {
                        const v = e.target.value;
                        setTplDraftLines((lines) =>
                          lines.map((l, j) => (j === i ? { ...l, location: v } : l)),
                        );
                      }}
                      placeholder="e.g. Unit 12B"
                      className="w-full rounded border border-transparent bg-[var(--enterprise-surface)] px-2 py-1.5 text-sm hover:border-[var(--enterprise-border)] focus:border-[var(--enterprise-primary)] focus:outline-none"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      value={row.trade}
                      onChange={(e) => {
                        const v = e.target.value;
                        setTplDraftLines((lines) =>
                          lines.map((l, j) => (j === i ? { ...l, trade: v } : l)),
                        );
                      }}
                      placeholder="General"
                      className="w-full rounded border border-transparent bg-[var(--enterprise-surface)] px-2 py-1.5 text-sm hover:border-[var(--enterprise-border)] focus:border-[var(--enterprise-primary)] focus:outline-none"
                    />
                  </td>
                  <td className="p-1 text-center">
                    <button
                      type="button"
                      className="rounded p-1 text-[var(--enterprise-text-muted)] hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                      disabled={tplDraftLines.length <= 1}
                      aria-label="Remove row"
                      onClick={() =>
                        setTplDraftLines((lines) =>
                          lines.length <= 1 ? lines : lines.filter((_, j) => j !== i),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="w-full rounded-xl border border-dashed border-[var(--enterprise-border)] py-2.5 text-sm font-medium text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)]"
          onClick={() =>
            setTplDraftLines((lines) => [...lines, { title: "", location: "", trade: "General" }])
          }
        >
          + Add another line
        </button>
      </EnterpriseSlideOver>
    </div>
  );
}

function AssigneeAvatar({ member }: { member: PunchRow["assignee"] }) {
  const initial = member?.name?.trim()?.charAt(0)?.toUpperCase() || "?";
  if (member?.image) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element -- user avatar URL */}
        <img
          src={member.image}
          alt=""
          className="h-7 w-7 shrink-0 rounded-full border border-[var(--enterprise-border)] object-cover"
        />
      </>
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--enterprise-border)] bg-[var(--enterprise-primary-soft)] text-[10px] font-bold text-[var(--enterprise-primary)]">
      {initial}
    </span>
  );
}

function BulkAssignSelect({
  members,
  onApply,
}: {
  members: { userId: string; name: string; email: string; image?: string | null }[];
  onApply: (userId: string | null) => void;
}) {
  const [v, setV] = useState("");
  return (
    <div className="flex items-center gap-1">
      <select
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="h-9 min-w-[8rem] rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 text-xs text-[var(--enterprise-text)]"
      >
        <option value="">Assign…</option>
        <option value="__unassigned">Unassigned</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.name}
          </option>
        ))}
      </select>
      <EnterpriseButton
        size="sm"
        variant="secondary"
        disabled={!v}
        onClick={() => {
          if (!v) return;
          const assigneeId = v === "__unassigned" ? null : v;
          onApply(assigneeId);
          setV("");
        }}
      >
        Apply
      </EnterpriseButton>
    </div>
  );
}

function BulkStatusSelect({ onApply }: { onApply: (st: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex items-center gap-1">
      <select
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="h-9 min-w-[8rem] rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 text-xs text-[var(--enterprise-text)]"
      >
        <option value="">Set status…</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {PUNCH_STATUS_LABEL[s] ?? s}
          </option>
        ))}
      </select>
      <EnterpriseButton
        size="sm"
        variant="secondary"
        disabled={!v}
        onClick={() => {
          if (v) onApply(v);
          setV("");
        }}
      >
        Apply
      </EnterpriseButton>
    </div>
  );
}

// fallow-ignore-next-line complexity
function PunchDetailSlider({
  open,
  punch,
  projectId,
  members,
  currentProject,
  onClose,
  patchMut,
  photoMut,
  removePhotoMut,
  deleteMut,
}: {
  open: boolean;
  punch: PunchRow | null;
  projectId: string;
  members: { userId: string; name: string; email: string; image?: string | null }[];
  currentProject: Project | null;
  onClose: () => void;
  patchMut: {
    mutate: (
      vars: { id: string; body: Parameters<typeof patchPunchItem>[2] },
      opts?: { onSuccess?: () => void; onSettled?: () => void },
    ) => void;
    isPending: boolean;
  };
  photoMut: { mutate: (v: { punchId: string; file: File }) => void; isPending: boolean };
  removePhotoMut: {
    mutate: (v: { punchId: string; nextPhotos: PunchReferencePhotoRow[] }) => void;
  };
  deleteMut: { mutate: (id: string) => void };
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [trade, setTrade] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [drawingVersionId, setDrawingVersionId] = useState<string>("");
  const [dueYmd, setDueYmd] = useState("");
  const [priority, setPriority] = useState("P2");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!punch) return;
    setTitle(punch.title);
    setDescription(punch.notes ?? "");
    setLocation(punch.location);
    setTrade(punch.trade);
    setAssigneeId(punch.assigneeId);
    setAssigneeIds(punchAssigneeIds(punch));
    setDrawingVersionId(punch.fileVersionId ?? "");
    setDueYmd(punch.dueDate ? punch.dueDate.slice(0, 10) : "");
    setPriority(punch.priority);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when switching row
  }, [punch?.id]);

  useEffect(() => {
    if (!punch || dirty) return;
    setTitle(punch.title);
    setDescription(punch.notes ?? "");
    setLocation(punch.location);
    setTrade(punch.trade);
    setAssigneeId(punch.assigneeId);
    setAssigneeIds(punchAssigneeIds(punch));
    setDrawingVersionId(punch.fileVersionId ?? "");
    setDueYmd(punch.dueDate ? punch.dueDate.slice(0, 10) : "");
    setPriority(punch.priority);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when server updatedAt changes
  }, [punch?.updatedAt, dirty]);

  if (!punch) return null;
  const photos = punch.referencePhotos ?? [];
  const sheetRows = sheetRowsForProject(currentProject);
  const selectedSheet = sheetRows.find((r) => r.fileVersionId === drawingVersionId) ?? null;
  const headerId = "punch-slide-title";
  const viewerHref = selectedSheet
    ? `/viewer?${new URLSearchParams({
        fileId: selectedSheet.fileId,
        fileVersionId: selectedSheet.fileVersionId,
        projectId,
        name: selectedSheet.fileName,
      }).toString()}`
    : null;

  const save = () => {
    patchMut.mutate(
      {
        id: punch.id,
        body: {
          title: title.trim() || punch.title,
          location: location.trim(),
          trade: trade.trim(),
          notes: description.trim() ? description.trim() : null,
          assigneeIds,
          assigneeId: assigneeId ?? null,
          fileId: selectedSheet?.fileId ?? null,
          fileVersionId: selectedSheet?.fileVersionId ?? null,
          pageNumber: null,
          dueDateYmd: dueYmd || null,
          priority,
        },
      },
      {
        onSuccess: () => {
          setDirty(false);
          toast.success("Changes saved.");
        },
      },
    );
  };

  const canReadyGc = punch.status === "OPEN" || punch.status === "IN_PROGRESS";
  const canClose = punch.status === "READY_FOR_GC";

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={onClose}
      panelVariant="floating"
      panelMaxWidthClass="max-w-[min(calc(100dvw-16px),560px)]"
      panelChromeClassName="border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-floating)]"
      closeOnBackdrop={false}
      closeOnEscape={false}
      ariaLabelledBy={headerId}
      header={
        <div className="min-w-0">
          <p
            id={headerId}
            className="text-lg font-semibold tracking-tight text-[var(--enterprise-text)]"
          >
            Punch List Item #{punch.punchNumber}
          </p>
          <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">Edit details below</p>
        </div>
      }
      footer={
        <div className="flex w-full flex-col gap-2">
          {canReadyGc || canClose ? (
            <div className="flex w-full gap-2">
              {canReadyGc ? (
                <EnterpriseButton
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  disabled={patchMut.isPending || punch.id.startsWith("optimistic-")}
                  onClick={() =>
                    patchMut.mutate({ id: punch.id, body: { status: "READY_FOR_GC" } })
                  }
                >
                  Ready for GC
                </EnterpriseButton>
              ) : null}
              {canClose ? (
                <EnterpriseButton
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  disabled={patchMut.isPending || punch.id.startsWith("optimistic-")}
                  onClick={() => patchMut.mutate({ id: punch.id, body: { status: "CLOSED" } })}
                >
                  Close
                </EnterpriseButton>
              ) : null}
            </div>
          ) : null}
          <div className="flex w-full items-center justify-between gap-2">
            <EnterpriseButton
              type="button"
              variant="danger"
              onClick={() => {
                if (!window.confirm("Delete this punch item?")) return;
                deleteMut.mutate(punch.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </EnterpriseButton>
            <EnterpriseButton
              type="button"
              disabled={!dirty}
              loading={patchMut.isPending}
              onClick={save}
            >
              {patchMut.isPending ? "Saving…" : "Save"}
            </EnterpriseButton>
          </div>
        </div>
      }
      bodyClassName="space-y-4 px-5 py-5"
      footerClassName="border-t border-[var(--enterprise-border)] px-5 py-3"
    >
      <div className={MOBILE_FORM_SECTION}>
        <div>
          <label htmlFor={`punch-title-${punch.id}`} className={MOBILE_FIELD_LABEL}>
            Title
          </label>
          <input
            id={`punch-title-${punch.id}`}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
            className={MOBILE_FIELD_INPUT}
          />
        </div>
        <div>
          <label htmlFor={`punch-notes-${punch.id}`} className={MOBILE_FIELD_LABEL}>
            Description / notes
          </label>
          <textarea
            id={`punch-notes-${punch.id}`}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setDirty(true);
            }}
            rows={3}
            className={MOBILE_FIELD_TEXTAREA}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`punch-loc-${punch.id}`} className={MOBILE_FIELD_LABEL}>
              Location
            </label>
            <input
              id={`punch-loc-${punch.id}`}
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setDirty(true);
              }}
              className={MOBILE_FIELD_INPUT}
            />
          </div>
          <div>
            <label htmlFor={`punch-pri-${punch.id}`} className={MOBILE_FIELD_LABEL}>
              Priority
            </label>
            <select
              id={`punch-pri-${punch.id}`}
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setDirty(true);
              }}
              className={MOBILE_FIELD_SELECT}
            >
              {PRIORITIES.map((pr) => (
                <option key={pr} value={pr}>
                  {PUNCH_PRIORITY_LABEL[pr] ?? pr}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor={`punch-trade-${punch.id}`} className={MOBILE_FIELD_LABEL}>
            Trade
          </label>
          <input
            id={`punch-trade-${punch.id}`}
            value={trade}
            onChange={(e) => {
              setTrade(e.target.value);
              setDirty(true);
            }}
            className={MOBILE_FIELD_INPUT}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className={MOBILE_FIELD_LABEL}>Assignees</p>
            <EnterpriseMemberMultiPicker
              members={members}
              value={assigneeIds}
              onChange={(selected) => {
                setAssigneeIds(selected);
                setAssigneeId(selected[0] ?? null);
                setDirty(true);
              }}
            />
          </div>
          <div>
            <label htmlFor={`punch-due-${punch.id}`} className={MOBILE_FIELD_LABEL}>
              Due date
            </label>
            <input
              id={`punch-due-${punch.id}`}
              type="date"
              value={dueYmd}
              onChange={(e) => {
                setDueYmd(e.target.value);
                setDirty(true);
              }}
              className={MOBILE_FIELD_INPUT}
            />
          </div>
        </div>
      </div>

      <div className={MOBILE_FORM_SECTION}>
        <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Status</p>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => {
            const on = punch.status === s;
            return (
              <button
                key={s}
                type="button"
                disabled={punch.id.startsWith("optimistic-")}
                onClick={() => {
                  patchMut.mutate({ id: punch.id, body: { status: s } });
                }}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  on
                    ? punchStatusBadgeClass(s)
                    : "border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)]"
                }`}
              >
                {PUNCH_STATUS_LABEL[s] ?? s}
              </button>
            );
          })}
        </div>
      </div>

      <div className={MOBILE_FORM_SECTION}>
        <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Photos</p>
        <input
          id={`slide-photo-${punch.id}`}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file && !punch.id.startsWith("optimistic-"))
              photoMut.mutate({ punchId: punch.id, file });
          }}
        />
        <EnterpriseButton
          type="button"
          size="sm"
          variant="secondary"
          disabled={photoMut.isPending || punch.id.startsWith("optimistic-")}
          loading={photoMut.isPending}
          onClick={() => document.getElementById(`slide-photo-${punch.id}`)?.click()}
        >
          <Camera className="h-4 w-4" />
          Take / add
        </EnterpriseButton>
        <div className="mt-2 flex flex-wrap gap-2">
          {photos.map((ph) => (
            <div key={ph.id} className="group relative">
              <PunchPhotoThumb projectId={projectId} punchId={punch.id} photo={ph} />
              <button
                type="button"
                className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--enterprise-text)]/75 text-white opacity-100 shadow sm:opacity-0 sm:group-hover:opacity-100"
                aria-label="Remove"
                onClick={() =>
                  removePhotoMut.mutate({
                    punchId: punch.id,
                    nextPhotos: photos.filter((x) => x.id !== ph.id),
                  })
                }
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className={MOBILE_FORM_SECTION}>
        <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">
          Drawing reference
        </p>
        <select
          value={drawingVersionId}
          onChange={(e) => {
            setDrawingVersionId(e.target.value);
            setDirty(true);
          }}
          className={MOBILE_FIELD_SELECT}
        >
          <option value="">No drawing reference</option>
          {sheetRows.map((r) => (
            <option key={r.fileVersionId} value={r.fileVersionId}>
              {r.label}
            </option>
          ))}
        </select>
        <div className="mt-2 flex flex-col gap-2">
          {viewerHref ? (
            <Link
              href={viewerHref}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 text-sm font-semibold text-[var(--enterprise-primary)] transition hover:bg-[var(--enterprise-hover-surface)]"
            >
              Open in viewer
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            </Link>
          ) : null}
          <Link
            href={
              selectedSheet
                ? `/projects/${projectId}/files?fileVersionId=${encodeURIComponent(selectedSheet.fileVersionId)}`
                : `/projects/${projectId}/files`
            }
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 text-sm font-semibold text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)]"
          >
            <FileText className="h-4 w-4 shrink-0" />
            {selectedSheet ? "Open selected sheet" : "Drawings & files"}
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          </Link>
        </div>
      </div>

      <PunchActivityTimeline punch={punch} />
    </EnterpriseSlideOver>
  );
}
