"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Camera,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";
import {
  applyPunchTemplate,
  bulkPatchPunchItems,
  completePunchPhotoUpload,
  createPunchItem,
  createPunchTemplate,
  deletePunchItem,
  fetchProject,
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
import { qk } from "@/lib/queryKeys";
import { referencePhotoContentType } from "@/lib/referencePhotoMime";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";

const STATUSES = ["OPEN", "IN_PROGRESS", "READY_FOR_GC", "CLOSED"] as const;
type PunchStatus = (typeof STATUSES)[number];

const STATUS_LABEL: Record<PunchStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  READY_FOR_GC: "Ready for GC",
  CLOSED: "Closed",
};

/** ACC-style status pills */
const STATUS_BADGE_CLASS: Record<PunchStatus, string> = {
  OPEN: "bg-[#fef2f2] text-[#991b1b] ring-1 ring-red-200/80",
  IN_PROGRESS: "bg-[#fffbeb] text-[#92400e] ring-1 ring-amber-200/80",
  READY_FOR_GC: "bg-[#eff6ff] text-[#1e40af] ring-1 ring-blue-200/80",
  CLOSED: "bg-[#f0fdf4] text-[#166534] ring-1 ring-emerald-200/80",
};

const PRIORITIES = ["P1", "P2", "P3"] as const;
const PRIORITY_LABEL: Record<string, string> = {
  P1: "High",
  P2: "Medium",
  P3: "Low",
};

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
  return p.assignee?.name?.trim() || "—";
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
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-[#e2e8f0] bg-[#f8fafc] text-[10px] text-[#94a3b8]">
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
        className="h-16 w-16 shrink-0 rounded-md border border-[#e2e8f0] object-cover"
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
      className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-[#94a3b8] hover:text-[#64748b]"
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ArrowUpAZ className="h-3.5 w-3.5 text-[#2563eb]" />
        ) : (
          <ArrowDownAZ className="h-3.5 w-3.5 text-[#2563eb]" />
        )
      ) : (
        <span className="inline-block w-3.5" />
      )}
    </button>
  );
}

export function ProjectPunchClient({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusPunchId = searchParams.get("punch")?.trim() || null;
  const newModalTitleId = useId();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterAssignee, setFilterAssignee] = useState<string>("ALL");
  const [filterLocation, setFilterLocation] = useState<string>("ALL");
  const [filterPriority, setFilterPriority] = useState<string>("ALL");
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
  const [newAssignee, setNewAssignee] = useState("");
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

  const stats = useMemo(() => {
    const total = items.length;
    const by = (s: PunchStatus) => items.filter((r) => r.status === s).length;
    return {
      total,
      open: by("OPEN"),
      inProgress: by("IN_PROGRESS"),
      readyGc: by("READY_FOR_GC"),
      closed: by("CLOSED"),
    };
  }, [items]);

  const locationOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of items) {
      const t = r.location?.trim();
      if (t) s.add(t);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = items.filter((r) => {
      if (filterStatus !== "ALL" && r.status !== filterStatus) return false;
      if (filterPriority !== "ALL" && r.priority !== filterPriority) return false;
      if (filterLocation !== "ALL" && r.location !== filterLocation) return false;
      if (filterAssignee === "UNASSIGNED") {
        if (r.assigneeId) return false;
      } else if (filterAssignee !== "ALL" && r.assigneeId !== filterAssignee) return false;
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
    });

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
        assigneeId: newAssignee || null,
        dueDateYmd: newDue || null,
        priority: newPriority,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.projectPunch(projectId) });
      setNewModalOpen(false);
      setNewTitle("");
      setNewLocation("");
      setNewTrade("General");
      setNewAssignee("");
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

  const progressSegments = useMemo(() => {
    const t = Math.max(1, stats.total);
    return [
      { key: "OPEN", pct: (stats.open / t) * 100, fill: "#dc2626", label: "Open" },
      {
        key: "IN_PROGRESS",
        pct: (stats.inProgress / t) * 100,
        fill: "#d97706",
        label: "In progress",
      },
      { key: "READY_FOR_GC", pct: (stats.readyGc / t) * 100, fill: "#2563eb", label: "Ready GC" },
      { key: "CLOSED", pct: (stats.closed / t) * 100, fill: "#16a34a", label: "Closed" },
    ];
  }, [stats]);

  const allSelected =
    filteredSorted.length > 0 && filteredSorted.every((r) => selectedIds.includes(r.id));
  const toggleAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(filteredSorted.map((r) => r.id));
  };

  return (
    <div
      className="min-h-0 flex-1 bg-[#f8fafc] pb-[env(safe-area-inset-bottom,0px)]"
      style={{ fontFamily: "var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 sm:py-6">
        {/* SECTION 1 — Header */}
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-white shadow-lg shadow-blue-600/25 ring-1 ring-white/30 sm:h-14 sm:w-14"
              aria-hidden
            >
              <ClipboardList className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-[#0f172a] sm:text-2xl">
                Punch list
              </h1>
              <p className="mt-0.5 text-sm text-[#64748b]">
                Track open items, photos, and closeouts.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={punchExportCsvUrl(projectId)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 text-xs font-semibold text-[#334155] shadow-sm"
            >
              <Download className="h-4 w-4" />
              Export
            </a>
            <button
              type="button"
              onClick={() => setChecklistModalOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-3 text-xs font-semibold text-[#1d4ed8] shadow-sm hover:bg-[#dbeafe]"
            >
              <FileText className="h-4 w-4" />
              From checklist
            </button>
            <button
              type="button"
              onClick={() => setNewModalOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2563eb] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#1d4ed8]"
            >
              <Plus className="h-4 w-4" />
              New Item
            </button>
          </div>
        </header>

        {/* SECTION 2 — Stats */}
        <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {(
            [
              ["Total", stats.total],
              ["Open", stats.open],
              ["In progress", stats.inProgress],
              ["Ready for GC", stats.readyGc],
              ["Closed", stats.closed],
            ] as const
          ).map(([label, n]) => (
            <div
              key={label}
              className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-3 shadow-sm"
            >
              <p className="text-2xl font-bold tabular-nums text-[#0f172a]">{n}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#94a3b8]">
                {label}
              </p>
            </div>
          ))}
        </section>
        <div className="mb-5 flex h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
          {progressSegments.map((s) => (
            <div
              key={s.key}
              title={`${s.label}: ${s.pct.toFixed(0)}%`}
              className="h-full min-w-0 transition-[width]"
              style={{ width: `${s.pct}%`, backgroundColor: s.fill }}
            />
          ))}
        </div>

        {/* Bulk bar OR filters */}
        {selectedIds.length > 0 ? (
          <div
            className="sticky top-0 z-20 mb-4 flex flex-col gap-3 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
          >
            <p className="text-sm font-semibold text-[#1e3a8a]">
              {selectedIds.length} item{selectedIds.length === 1 ? "" : "s"} selected
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <BulkAssignSelect
                members={members}
                onApply={(userId) => bulkMut.mutate({ ids: selectedIds, assigneeId: userId })}
              />
              <BulkStatusSelect
                onApply={(st) => bulkMut.mutate({ ids: selectedIds, status: st })}
              />
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50"
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
                <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                Delete
              </button>
              <button
                type="button"
                className="text-xs font-semibold text-[#2563eb] underline"
                onClick={() => setSelectedIds([])}
              >
                Clear selection
              </button>
            </div>
          </div>
        ) : (
          <section className="mb-4 flex flex-col gap-2 rounded-lg border border-[#e2e8f0] bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
            <input
              type="search"
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-10 w-full min-w-[8rem] flex-1 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm text-[#0f172a] placeholder:text-[#94a3b8] sm:max-w-xs"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="min-h-10 min-w-[7rem] rounded-md border border-[#e2e8f0] bg-white px-2 text-sm"
            >
              <option value="ALL">Status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="min-h-10 min-w-[8rem] flex-1 rounded-md border border-[#e2e8f0] bg-white px-2 text-sm sm:flex-none"
            >
              <option value="ALL">Assignee</option>
              <option value="UNASSIGNED">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="min-h-10 min-w-[8rem] flex-1 rounded-md border border-[#e2e8f0] bg-white px-2 text-sm sm:flex-none"
            >
              <option value="ALL">Location</option>
              {locationOptions.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="min-h-10 min-w-[7rem] rounded-md border border-[#e2e8f0] bg-white px-2 text-sm"
            >
              <option value="ALL">Priority</option>
              {PRIORITIES.map((pr) => (
                <option key={pr} value={pr}>
                  {PRIORITY_LABEL[pr]}
                </option>
              ))}
            </select>
            <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => setChecklistModalOpen(true)}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md border border-[#bfdbfe] bg-[#eff6ff] px-3 text-sm font-semibold text-[#1d4ed8] sm:flex-none"
              >
                <FileText className="h-4 w-4 shrink-0" />
                Add from checklist
              </button>
              <button
                type="button"
                onClick={() => setManageTemplatesOpen(true)}
                className="min-h-10 rounded-md border border-[#e2e8f0] bg-white px-3 text-sm font-medium text-[#64748b] sm:shrink-0"
              >
                Edit checklists
              </button>
            </div>
          </section>
        )}

        {/* SECTION 4 — Table */}
        {isPending ? (
          <div className="py-16">
            <EnterpriseLoadingState
              variant="minimal"
              message="Loading punch list…"
              label="Loading"
            />
          </div>
        ) : (
          <div
            className="-mx-3 overflow-x-auto sm:mx-0"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-[920px] w-full border-collapse rounded-lg border border-[#e2e8f0] bg-white shadow-sm">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f1f5f9]">
                    <th className="w-10 px-2 py-2 text-left">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[#cbd5e1]"
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
                  {filteredSorted.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-[#94a3b8]">
                        No items match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredSorted.map((p) => {
                      const sel = selectedIds.includes(p.id);
                      const active = activePunchId === p.id && slideOpen;
                      const rowHi = sel || active;
                      const st = p.status as PunchStatus;
                      return (
                        <tr
                          key={p.id}
                          id={`punch-row-${p.id}`}
                          onClick={() => openRow(p.id)}
                          className={`h-11 cursor-pointer border-b border-[#e2e8f0] text-sm transition-colors last:border-b-0 ${
                            rowHi
                              ? "border-l-4 border-l-[#2563eb] bg-[#eff6ff]"
                              : "hover:bg-[#f8fafc]"
                          }`}
                        >
                          <td className="px-2 py-0" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-[#cbd5e1]"
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
                          <td className="px-3 font-mono text-xs font-semibold text-[#2563eb]">
                            {p.punchNumber}
                          </td>
                          <td className="max-w-[220px] truncate px-3 font-medium text-[#0f172a]">
                            {p.title}
                          </td>
                          <td className="max-w-[160px] truncate px-3 text-[#475569]">
                            {p.location}
                          </td>
                          <td className="px-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <AssigneeAvatar member={p.assignee} />
                              <span className="truncate text-[#334155]">{assigneeLabel(p)}</span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 text-[#475569]">
                            {formatTableDate(p.dueDate)}
                          </td>
                          <td className="px-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE_CLASS[st] ?? "bg-slate-100 text-slate-700"}`}
                            >
                              {STATUS_LABEL[st] ?? p.status}
                            </span>
                          </td>
                          <td className="px-3 text-[#475569]">
                            {PRIORITY_LABEL[p.priority] ?? p.priority}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Mobile FAB — thumb reach + PWA field */}
      <div
        className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-2 sm:hidden"
        style={{ bottom: "max(1rem, calc(1rem + env(safe-area-inset-bottom, 0px)))" }}
      >
        <button
          type="button"
          onClick={() => setChecklistModalOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8] shadow-lg"
          aria-label="Add from checklist"
        >
          <FileText className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={() => setNewModalOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-lg"
          aria-label="New punch item"
        >
          <Plus className="h-7 w-7" />
        </button>
      </div>

      <PunchDetailSlider
        open={slideOpen && !!activePunch}
        punch={activePunch}
        projectId={projectId}
        members={members}
        onClose={closeSlide}
        patchMut={patchMut}
        photoMut={photoMut}
        removePhotoMut={removePhotoMut}
        deleteMut={deleteMut}
      />

      {/* New item modal */}
      {newModalOpen ? (
        <div className="fixed inset-0 z-[102] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[#0f172a]/50 backdrop-blur-[1px]"
            aria-label="Close"
            onClick={() => setNewModalOpen(false)}
          />
          <div
            className="relative w-full max-w-md rounded-t-xl border border-[#e2e8f0] bg-white p-5 shadow-2xl sm:rounded-xl"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 12px))" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={newModalTitleId}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id={newModalTitleId} className="text-lg font-semibold text-[#0f172a]">
                New punch list item
              </h2>
              <button
                type="button"
                onClick={() => setNewModalOpen(false)}
                className="rounded-lg p-2 text-[#94a3b8] hover:bg-[#f1f5f9]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTitle.trim() || !newLocation.trim()) {
                  setNewMsg("Title and location are required.");
                  return;
                }
                createMut.mutate();
              }}
            >
              <label className="block text-xs font-semibold text-[#64748b]">
                Title (required)
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#e2e8f0] px-3 py-2 text-sm"
                  required
                />
              </label>
              <label className="block text-xs font-semibold text-[#64748b]">
                Location
                <input
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#e2e8f0] px-3 py-2 text-sm"
                  required
                />
              </label>
              <label className="block text-xs font-semibold text-[#64748b]">
                Trade
                <input
                  value={newTrade}
                  onChange={(e) => setNewTrade(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#e2e8f0] px-3 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-[#64748b]">
                  Assignee
                  <select
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                    className="mt-1 w-full rounded-md border border-[#e2e8f0] px-2 py-2 text-sm"
                  >
                    <option value="">Select…</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-[#64748b]">
                  Priority
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="mt-1 w-full rounded-md border border-[#e2e8f0] px-2 py-2 text-sm"
                  >
                    {PRIORITIES.map((pr) => (
                      <option key={pr} value={pr}>
                        {PRIORITY_LABEL[pr]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-xs font-semibold text-[#64748b]">
                Due date
                <input
                  type="date"
                  value={newDue}
                  onChange={(e) => setNewDue(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#e2e8f0] px-3 py-2 text-sm"
                />
              </label>
              {newMsg ? <p className="text-sm text-red-600">{newMsg}</p> : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewModalOpen(false)}
                  className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMut.isPending}
                  className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {createMut.isPending ? "Creating…" : "Create Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Add punch rows from a saved checklist */}
      {checklistModalOpen ? (
        <div className="fixed inset-0 z-[102] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[#0f172a]/50 backdrop-blur-[1px]"
            aria-label="Close"
            onClick={() => setChecklistModalOpen(false)}
          />
          <div
            className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-xl border border-[#e2e8f0] bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-xl"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 12px))" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="punch-checklist-modal-title"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id="punch-checklist-modal-title" className="text-lg font-semibold text-[#0f172a]">
                Add from a checklist
              </h2>
              <button
                type="button"
                onClick={() => setChecklistModalOpen(false)}
                className="rounded-lg p-2 text-[#94a3b8] hover:bg-[#f1f5f9]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-[#64748b]">
              Pick a saved checklist. Each line becomes a new punch item on this project (you can
              edit them afterward).
            </p>
            {templates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-6 text-center">
                <p className="mb-3 text-sm text-[#64748b]">
                  You don&apos;t have any saved checklists yet.
                </p>
                <button
                  type="button"
                  className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => {
                    setChecklistModalOpen(false);
                    setManageTemplatesOpen(true);
                  }}
                >
                  Create a checklist
                </button>
              </div>
            ) : (
              <ul className="space-y-2">
                {templates.map((t) => {
                  const n = countPunchTemplateItems(t.itemsJson);
                  return (
                    <li
                      key={t.id}
                      className="flex flex-col gap-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-[#0f172a]">{t.name}</p>
                        <p className="text-xs text-[#64748b]">
                          {n === 0
                            ? "No lines (cannot add)"
                            : `${n} punch line${n === 1 ? "" : "s"}`}
                          {t.projectId ? " · This project" : " · All projects"}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={applyTplMut.isPending || n === 0}
                        className="shrink-0 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        onClick={() => applyTplMut.mutate(t.id)}
                      >
                        {applyTplMut.isPending ? "Adding…" : "Add to punch list"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <button
              type="button"
              className="mt-4 w-full rounded-lg border border-[#e2e8f0] py-2 text-sm font-medium text-[#64748b]"
              onClick={() => {
                setChecklistModalOpen(false);
                setManageTemplatesOpen(true);
              }}
            >
              Create or edit checklists
            </button>
          </div>
        </div>
      ) : null}

      {/* Save reusable checklists (templates) */}
      {manageTemplatesOpen ? (
        <div className="fixed inset-0 z-[102] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[#0f172a]/50 backdrop-blur-[1px]"
            aria-label="Close"
            onClick={() => setManageTemplatesOpen(false)}
          />
          <div
            className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-[#e2e8f0] bg-white p-5 shadow-2xl sm:max-w-2xl sm:rounded-xl"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 12px))" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="punch-manage-checklists-title"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2
                id="punch-manage-checklists-title"
                className="text-lg font-semibold text-[#0f172a]"
              >
                Reusable checklists
              </h2>
              <button
                type="button"
                onClick={() => setManageTemplatesOpen(false)}
                className="rounded-lg p-2 text-[#94a3b8] hover:bg-[#f1f5f9]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-xs text-[#64748b]">
              Saved checklists you can add to this punch list anytime.
            </p>
            <ul className="mb-6 max-h-40 space-y-1 overflow-auto rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-2">
              {templates.length === 0 ? (
                <li className="text-xs text-[#94a3b8]">None yet — add one below.</li>
              ) : (
                templates.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 text-sm text-[#334155]"
                  >
                    <span className="min-w-0 truncate">{t.name}</span>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-semibold text-[#2563eb]"
                      onClick={() => applyTplMut.mutate(t.id)}
                    >
                      Add to project
                    </button>
                  </li>
                ))
              )}
            </ul>
            <p className="mb-2 text-xs font-semibold text-[#64748b]">New checklist</p>
            <label className="mb-2 block text-xs text-[#64748b]">
              Name
              <input
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                placeholder="e.g. Level 1 walkthrough"
                className="mt-1 w-full rounded-md border border-[#e2e8f0] px-3 py-2 text-sm"
              />
            </label>
            <fieldset className="mb-3 text-xs text-[#64748b]">
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
            <p className="mb-1 text-xs text-[#64748b]">
              Lines to add when you use this checklist (title or location required per row).
            </p>
            <div className="mb-2 overflow-x-auto rounded-md border border-[#e2e8f0]">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f1f5f9] text-left text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
                    <th className="px-2 py-2">What to fix</th>
                    <th className="px-2 py-2">Where</th>
                    <th className="px-2 py-2 w-28">Trade</th>
                    <th className="w-10 px-1 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {tplDraftLines.map((row, i) => (
                    <tr key={i} className="border-b border-[#f1f5f9] last:border-0">
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
                          className="w-full rounded border border-transparent bg-white px-2 py-1.5 text-sm hover:border-[#e2e8f0] focus:border-[#2563eb] focus:outline-none"
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
                          className="w-full rounded border border-transparent bg-white px-2 py-1.5 text-sm hover:border-[#e2e8f0] focus:border-[#2563eb] focus:outline-none"
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
                          className="w-full rounded border border-transparent bg-white px-2 py-1.5 text-sm hover:border-[#e2e8f0] focus:border-[#2563eb] focus:outline-none"
                        />
                      </td>
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          className="rounded p-1 text-[#94a3b8] hover:bg-[#fee2e2] hover:text-red-600 disabled:opacity-30"
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
              className="mb-3 w-full rounded-lg border border-dashed border-[#cbd5e1] py-2 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc]"
              onClick={() =>
                setTplDraftLines((lines) => [
                  ...lines,
                  { title: "", location: "", trade: "General" },
                ])
              }
            >
              + Add another line
            </button>
            <button
              type="button"
              disabled={!tplName.trim() || createTplMut.isPending}
              onClick={() => {
                if (!tplName.trim()) return;
                if (!tplDraftLines.some((r) => r.title.trim() || r.location.trim())) {
                  toast.error("Add at least one line with a title or a location.");
                  return;
                }
                createTplMut.mutate();
              }}
              className="w-full rounded-lg bg-[#2563eb] py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {createTplMut.isPending ? "Saving…" : "Save checklist"}
            </button>
          </div>
        </div>
      ) : null}
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
          className="h-7 w-7 shrink-0 rounded-full border border-[#e2e8f0] object-cover"
        />
      </>
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#e2e8f0] bg-[#e0e7ff] text-[10px] font-bold text-[#3730a3]">
      {initial}
    </span>
  );
}

function BulkAssignSelect({
  members,
  onApply,
}: {
  members: { userId: string; name: string }[];
  onApply: (userId: string | null) => void;
}) {
  const [v, setV] = useState("");
  return (
    <div className="flex items-center gap-1">
      <select
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="h-9 min-w-[8rem] rounded-md border border-[#e2e8f0] bg-white px-2 text-xs"
      >
        <option value="">Assign…</option>
        <option value="__unassigned">Unassigned</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!v}
        className="h-9 rounded-md bg-white px-2 text-xs font-semibold text-[#2563eb] ring-1 ring-[#bfdbfe] disabled:opacity-50"
        onClick={() => {
          if (!v) return;
          const assigneeId = v === "__unassigned" ? null : v;
          onApply(assigneeId);
          setV("");
        }}
      >
        Apply
      </button>
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
        className="h-9 min-w-[8rem] rounded-md border border-[#e2e8f0] bg-white px-2 text-xs"
      >
        <option value="">Set status…</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!v}
        className="h-9 rounded-md bg-white px-2 text-xs font-semibold text-[#2563eb] ring-1 ring-[#bfdbfe] disabled:opacity-50"
        onClick={() => {
          if (v) onApply(v);
          setV("");
        }}
      >
        Apply
      </button>
    </div>
  );
}

function PunchDetailSlider({
  open,
  punch,
  projectId,
  members,
  onClose,
  patchMut,
  photoMut,
  removePhotoMut,
  deleteMut,
}: {
  open: boolean;
  punch: PunchRow | null;
  projectId: string;
  members: { userId: string; name: string }[];
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
    setDueYmd(punch.dueDate ? punch.dueDate.slice(0, 10) : "");
    setPriority(punch.priority);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when server updatedAt changes
  }, [punch?.updatedAt, dirty]);

  if (!punch) return null;
  const photos = punch.referencePhotos ?? [];
  const headerId = "punch-slide-title";

  const save = () => {
    patchMut.mutate(
      {
        id: punch.id,
        body: {
          title: title.trim() || punch.title,
          location: location.trim(),
          trade: trade.trim(),
          notes: description.trim() ? description.trim() : null,
          assigneeId: assigneeId ?? null,
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

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={onClose}
      closeOnBackdrop={false}
      panelMaxWidthClass="max-w-[min(100vw,560px)] sm:max-w-[560px]"
      ariaLabelledBy={headerId}
      header={
        <div>
          <p id={headerId} className="text-base font-semibold text-[#0f172a]">
            Punch List Item #{punch.punchNumber}
          </p>
          <p className="mt-0.5 text-xs text-[#94a3b8]">Edit details below</p>
        </div>
      }
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
            onClick={() => {
              if (!window.confirm("Delete this punch item?")) return;
              deleteMut.mutate(punch.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
          <button
            type="button"
            disabled={!dirty || patchMut.isPending}
            onClick={save}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#2563eb] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {patchMut.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      }
      bodyClassName="px-4 py-4 space-y-4 bg-white"
    >
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
        Title
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
          className="mt-1 w-full rounded-md border border-[#e2e8f0] px-3 py-2 text-sm font-medium text-[#0f172a]"
        />
      </label>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
        Description / notes
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setDirty(true);
          }}
          rows={3}
          className="mt-1 w-full rounded-md border border-[#e2e8f0] px-3 py-2 text-sm"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
          Location
          <input
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setDirty(true);
            }}
            className="mt-1 w-full rounded-md border border-[#e2e8f0] px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
          Priority
          <select
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setDirty(true);
            }}
            className="mt-1 w-full rounded-md border border-[#e2e8f0] px-2 py-2 text-sm"
          >
            {PRIORITIES.map((pr) => (
              <option key={pr} value={pr}>
                {PRIORITY_LABEL[pr]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
        Trade
        <input
          value={trade}
          onChange={(e) => {
            setTrade(e.target.value);
            setDirty(true);
          }}
          className="mt-1 w-full rounded-md border border-[#e2e8f0] px-3 py-2 text-sm"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
          Assignee
          <select
            value={assigneeId ?? ""}
            onChange={(e) => {
              setAssigneeId(e.target.value || null);
              setDirty(true);
            }}
            className="mt-1 w-full rounded-md border border-[#e2e8f0] px-2 py-2 text-sm"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
          Due date
          <input
            type="date"
            value={dueYmd}
            onChange={(e) => {
              setDueYmd(e.target.value);
              setDirty(true);
            }}
            className="mt-1 w-full rounded-md border border-[#e2e8f0] px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
          Status
        </p>
        <div className="flex flex-wrap gap-1">
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
                    ? STATUS_BADGE_CLASS[s]
                    : "border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b] hover:bg-[#f1f5f9]"
                }`}
              >
                {STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
          Photos
        </p>
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
        <button
          type="button"
          disabled={photoMut.isPending || punch.id.startsWith("optimistic-")}
          onClick={() => document.getElementById(`slide-photo-${punch.id}`)?.click()}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#e2e8f0] bg-white px-3 text-xs font-semibold text-[#334155] disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
          Take / add
        </button>
        <div className="mt-2 flex flex-wrap gap-2">
          {photos.map((ph) => (
            <div key={ph.id} className="group relative">
              <PunchPhotoThumb projectId={projectId} punchId={punch.id} photo={ph} />
              <button
                type="button"
                className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-white opacity-100 shadow sm:opacity-0 sm:group-hover:opacity-100"
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

      <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
          Drawing reference
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-[#64748b]">
          Open the project&apos;s drawings, pick a PDF sheet, then launch the viewer. (Per-item
          sheet links will appear here when punch items are tied to files.)
        </p>
        <Link
          href={`/projects/${projectId}/files`}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-[#e2e8f0] bg-white py-2.5 text-xs font-semibold text-[#2563eb] hover:bg-[#eff6ff]"
        >
          <FileText className="h-4 w-4 shrink-0" />
          Drawings &amp; files
          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </Link>
        <Link
          href={`/projects/${projectId}/files`}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-transparent py-2 text-xs font-semibold text-[#2563eb] underline-offset-2 hover:underline"
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          Choose sheet to view
        </Link>
      </div>

      <div className="border-t border-[#e2e8f0] pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Activity</p>
        <p className="mt-1 text-xs text-[#64748b]">
          Created{" "}
          {new Date(punch.createdAt).toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
        {punch.updatedAt !== punch.createdAt ? (
          <p className="text-xs text-[#64748b]">
            Last updated{" "}
            {new Date(punch.updatedAt).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        ) : null}
      </div>
    </EnterpriseSlideOver>
  );
}
