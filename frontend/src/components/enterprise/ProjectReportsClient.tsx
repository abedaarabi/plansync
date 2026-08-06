"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardList,
  CloudRain,
  CloudSun,
  Download,
  FilePen,
  Image as ImageIcon,
  LayoutGrid,
  Package,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  Send,
  Sun,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { nanoid } from "nanoid";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";
import { FieldReportCreateSlideOver } from "@/components/enterprise/FieldReportCreateSlideOver";
import { FieldReportsOverview } from "@/components/enterprise/FieldReportsOverview";
import { StatusFilterChips } from "@/components/enterprise/issueListControls";
import { OmEmptyState } from "@/components/enterprise/OmEmptyState";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import {
  deleteFieldReport,
  fetchProject,
  fetchProjectFieldReports,
  fetchWorkspaceMembers,
  patchFieldReport,
  ProRequiredError,
  sendFieldReportEmail,
  type FieldReportRow,
} from "@/lib/api-client";
import {
  buildWeeklyVirtuals,
  compressImageFileToJpegDataUrl,
  dailyDisplayNumbers,
  emptyDetails,
  formatReportTableDate,
  formatWeekEndingLabel,
  normalizeFieldReport,
  parseDetails,
  primaryWeatherLabel,
  sumCrewWorkers,
  type FieldReportDetails,
  type WeeklyVirtual,
} from "@/lib/fieldReportUtils";
import {
  computeMissingDailyDates,
  fieldReportMatchesOverviewFilter,
  type FieldReportsOverviewFilter,
} from "@/lib/fieldReportsOverviewStats";
import { FIELD_REPORT_STATUS_LABEL, fieldReportStatusBadgeClass } from "@/lib/issueStatusStyle";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_SELECT,
  MOBILE_FIELD_TEXTAREA,
  MOBILE_FORM_SECTION,
} from "@/lib/mobileFormStyles";
import {
  OM_COMPACT_CHIP_ACTIVE,
  OM_COMPACT_CHIP_IDLE,
  OM_COMPACT_SELECT,
  OM_PAGE_CLASS,
} from "@/lib/omCompactStyles";
import { qk } from "@/lib/queryKeys";
import { useTickNowMs } from "@/lib/useTickNowMs";

/** Slide-over scroll surface + cards */
const SLIDER_BODY = "space-y-5 px-4 py-5 sm:px-5";
const SLIDER_CARD = MOBILE_FORM_SECTION;
const SLIDER_INPUT = MOBILE_FIELD_INPUT;

type StatusChip = "ALL" | "DRAFT" | "SUBMITTED";

const STATUS_FILTER_DEFS: { key: StatusChip; label: string; Icon: LucideIcon }[] = [
  { key: "ALL", label: "All", Icon: LayoutGrid },
  { key: "DRAFT", label: "Draft", Icon: FilePen },
  { key: "SUBMITTED", label: "Submitted", Icon: CheckCircle2 },
];

const FILTER_LABEL_CLASS =
  "mb-0.5 flex items-center gap-1 text-xs font-medium text-[var(--enterprise-text-muted)]";

const TYPE_CHIP_DEFS = [
  { key: "ALL" as const, label: "All types" },
  { key: "DAILY" as const, label: "Daily" },
  { key: "WEEKLY" as const, label: "Weekly" },
];

function SliderSectionCard({
  kicker,
  title,
  icon,
  children,
}: {
  kicker?: string;
  title: string;
  icon?: ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={SLIDER_CARD}>
      <div className="mb-4 flex items-start gap-3 border-b border-[var(--enterprise-border)]/60 pb-3.5">
        {icon ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text-muted)]">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1 pt-0.5">
          {kicker ? (
            <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">{kicker}</p>
          ) : null}
          <h3
            className={`text-[15px] font-semibold leading-snug tracking-tight text-[var(--enterprise-text)] ${kicker ? "mt-0.5" : ""}`}
          >
            {title}
          </h3>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

const WEATHER_OPTIONS = ["Sunny", "Cloudy", "Rainy", "Fog", "Windy", "Overcast"] as const;
const WORK_CONDITIONS = ["Good for work", "Marginal", "Stopped work", "Indoor only"] as const;

const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Split on commas, semicolons, or whitespace; dedupe case-insensitively. */
function parseRecipientEmails(raw: string): string[] {
  const parts = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (!SIMPLE_EMAIL.test(p)) continue;
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

type SortCol = "num" | "date" | "type" | "author" | "weather" | "workers" | "status";
type SortDir = "asc" | "desc";

type MergedRow =
  | { kind: "daily"; r: FieldReportRow; sortKey: string }
  | { kind: "weekly"; w: WeeklyVirtual; sortKey: string };

function mergeRows(reports: FieldReportRow[]): MergedRow[] {
  const weeks = buildWeeklyVirtuals(reports);
  const dailies = reports.filter((r) => (r.reportKind ?? "DAILY") === "DAILY");
  const out: MergedRow[] = [
    ...dailies.map((r) => ({ kind: "daily" as const, r, sortKey: r.reportDate.slice(0, 10) })),
    ...weeks.map((w) => ({ kind: "weekly" as const, w, sortKey: w.weekEndingFriday })),
  ];
  return out.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

function weeklyStatus(w: WeeklyVirtual): "DRAFT" | "SUBMITTED" {
  return w.days.every((d) => (d.status ?? "DRAFT") === "SUBMITTED") ? "SUBMITTED" : "DRAFT";
}

function weeklyWorkers(w: WeeklyVirtual): number {
  return w.days.reduce((acc, d) => {
    const tw = typeof d.totalWorkers === "number" && d.totalWorkers > 0 ? d.totalWorkers : 0;
    if (tw > 0) return acc + tw;
    return acc + sumCrewWorkers(parseDetails(d.details));
  }, 0);
}

function workerCountForDaily(r: FieldReportRow): number {
  if (typeof r.totalWorkers === "number" && r.totalWorkers > 0) return r.totalWorkers;
  return sumCrewWorkers(parseDetails(r.details));
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
      className="inline-flex items-center gap-1 text-[11px] font-normal uppercase tracking-wide text-[var(--enterprise-text-muted)] hover:text-[var(--enterprise-text)]"
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

function WeatherIcon({ text }: { text: string }) {
  const s = text.toLowerCase();
  if (s.includes("rain"))
    return <CloudRain className="h-4 w-4 shrink-0 text-sky-600" strokeWidth={1.75} />;
  if (s.includes("sun") || s.includes("clear"))
    return <Sun className="h-4 w-4 shrink-0 text-amber-500" strokeWidth={1.75} />;
  return <CloudSun className="h-4 w-4 shrink-0 text-sky-500" strokeWidth={1.75} />;
}

function exportFieldReportsCsv(
  projectName: string,
  rows: MergedRow[],
  numMap: Map<string, string>,
) {
  const lines = [
    ["#", "Date", "Type", "Written by", "Weather", "Workers", "Status"].join(","),
    ...rows.map((row) => {
      if (row.kind === "daily") {
        const r = row.r;
        const w = primaryWeatherLabel(r.weather, parseDetails(r.details));
        return [
          numMap.get(r.id) ?? r.id.slice(0, 8),
          formatReportTableDate(r.reportDate),
          "Daily",
          (r.authorLabel ?? "").replaceAll(",", " "),
          w.replaceAll(",", " "),
          String(workerCountForDaily(r)),
          r.status ?? "DRAFT",
        ].join(",");
      }
      const wk = row.w;
      return [
        wk.weekLabel,
        formatWeekEndingLabel(wk.weekEndingFriday),
        "Weekly",
        "",
        "",
        String(weeklyWorkers(wk)),
        weeklyStatus(wk),
      ].join(",");
    }),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${projectName.replace(/[^\w\-]+/g, "_")}-field-reports.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// fallow-ignore-next-line complexity
export function ProjectReportsClient({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusReportId = searchParams.get("report")?.trim() || null;
  const newTitleId = useId();
  const weeklyTitleId = useId();

  const nowMs = useTickNowMs();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "DAILY" | "WEEKLY">("ALL");
  const [filterStatus, setFilterStatus] = useState<StatusChip>("ALL");
  const [filterAuthor, setFilterAuthor] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [overviewFilter, setOverviewFilter] = useState<FieldReportsOverviewFilter>("ALL");
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [slideOpen, setSlideOpen] = useState(false);
  const [activeDailyId, setActiveDailyId] = useState<string | null>(null);
  const [activeWeekly, setActiveWeekly] = useState<WeeklyVirtual | null>(null);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [createDefaultDate, setCreateDefaultDate] = useState<string | undefined>();
  const [sendModalOpen, setSendModalOpen] = useState(false);

  const [draft, setDraft] = useState<FieldReportDetails>(emptyDetails());
  const [draftMeta, setDraftMeta] = useState<{
    reportDate: string;
    status: "DRAFT" | "SUBMITTED";
    authorLabel: string;
    notes: string;
  }>({
    reportDate: new Date().toISOString().slice(0, 10),
    status: "DRAFT",
    authorLabel: "",
    notes: "",
  });
  const baselineRef = useRef<string>("");
  /** After user closes the slider, URL can lag; skip URL→open sync until `report` is cleared. */
  const closingFromUiRef = useRef(false);

  const [sendRecipients, setSendRecipients] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sendOpts, setSendOpts] = useState({
    weather: true,
    workers: true,
    completed: true,
    delays: true,
    photos: true,
    materials: false,
  });
  const [saving, setSaving] = useState(false);

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

  const { data: reports = [], isPending } = useQuery({
    queryKey: qk.projectFieldReports(projectId),
    queryFn: async () => {
      const rows = await fetchProjectFieldReports(projectId);
      return rows.map(normalizeFieldReport);
    },
  });

  const numMap = useMemo(() => dailyDisplayNumbers(reports), [reports]);
  const merged = useMemo(() => mergeRows(reports), [reports]);

  const authorOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of reports) {
      const a = r.authorLabel?.trim();
      if (a) s.add(a);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [reports]);

  const missingDateKeys = useMemo(() => computeMissingDailyDates(reports, nowMs), [reports, nowMs]);

  const memberNames = useMemo(
    () => members.map((m) => m.name?.trim()).filter((n): n is string => Boolean(n)),
    [members],
  );

  const defaultAuthor = memberNames[0] ?? "";

  const onOverviewFilterChange = (key: FieldReportsOverviewFilter) => {
    setOverviewFilter(key);
    if (key === "DRAFT" || key === "SUBMITTED") setFilterStatus(key);
    else if (key === "ALL" || key === "THIS_MONTH" || key === "MISSING") setFilterStatus("ALL");
    if (key === "DAILY" || key === "WEEKLY") setFilterType(key);
    else if (key !== "MISSING") setFilterType("ALL");
  };

  const clearFilters = () => {
    setSearch("");
    setFilterType("ALL");
    setFilterStatus("ALL");
    setFilterAuthor("ALL");
    setDateFrom("");
    setDateTo("");
    setOverviewFilter("ALL");
  };

  const filtersActive =
    overviewFilter !== "ALL" ||
    filterStatus !== "ALL" ||
    filterType !== "ALL" ||
    filterAuthor !== "ALL" ||
    Boolean(search.trim()) ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const filtered = useMemo(() => {
    if (overviewFilter === "MISSING") return [];
    const q = search.trim().toLowerCase();
    const from = dateFrom ? dateFrom : null;
    const to = dateTo ? dateTo : null;
    return merged.filter(
      // fallow-ignore-next-line complexity
      (row) => {
        if (filterType === "DAILY" && row.kind !== "daily") return false;
        if (filterType === "WEEKLY" && row.kind !== "weekly") return false;
        if (row.kind === "daily") {
          const r = row.r;
          if (!fieldReportMatchesOverviewFilter(r, overviewFilter, nowMs, missingDateKeys)) {
            return false;
          }
          const st = (r.status ?? "DRAFT") as "DRAFT" | "SUBMITTED";
          if (filterStatus !== "ALL" && st !== filterStatus) return false;
          if (filterAuthor !== "ALL" && (r.authorLabel?.trim() || "") !== filterAuthor)
            return false;
          const d = r.reportDate.slice(0, 10);
          if (from && d < from) return false;
          if (to && d > to) return false;
          if (q) {
            const blob = [
              numMap.get(r.id) ?? "",
              r.authorLabel ?? "",
              primaryWeatherLabel(r.weather, parseDetails(r.details)),
              r.notes ?? "",
            ]
              .join(" ")
              .toLowerCase();
            if (!blob.includes(q)) return false;
          }
          return true;
        }
        const w = row.w;
        if (overviewFilter === "DAILY") return false;
        if (overviewFilter === "WEEKLY") {
          /* keep weekly */
        } else if (overviewFilter === "DRAFT" || overviewFilter === "SUBMITTED") {
          if (weeklyStatus(w) !== overviewFilter) return false;
        } else if (overviewFilter === "THIS_MONTH") {
          const monthStart = new Date(nowMs);
          monthStart.setDate(1);
          monthStart.setHours(0, 0, 0, 0);
          if (new Date(w.weekEndingFriday + "T12:00:00").getTime() < monthStart.getTime()) {
            return false;
          }
        }
        const st = weeklyStatus(w);
        if (filterStatus !== "ALL" && st !== filterStatus) return false;
        if (filterAuthor !== "ALL") return false;
        const d = w.weekEndingFriday;
        if (from && d < from) return false;
        if (to && d > to) return false;
        if (q) {
          const blob = [w.weekLabel, formatWeekEndingLabel(w.weekEndingFriday), "auto"]
            .join(" ")
            .toLowerCase();
          if (!blob.includes(q)) return false;
        }
        return true;
      },
    );
  }, [
    merged,
    search,
    filterType,
    filterStatus,
    filterAuthor,
    dateFrom,
    dateTo,
    numMap,
    overviewFilter,
    missingDateKeys,
    nowMs,
  ]);

  const sortedRows = useMemo(() => {
    const rows = [...filtered];
    const cmp = (a: MergedRow, b: MergedRow): number => {
      const dailyA = a.kind === "daily" ? a.r : null;
      const dailyB = b.kind === "daily" ? b.r : null;
      const weekA = a.kind === "weekly" ? a.w : null;
      const weekB = b.kind === "weekly" ? b.w : null;
      let va: string | number = 0;
      let vb: string | number = 0;
      switch (sortCol) {
        case "num":
          va =
            a.kind === "daily"
              ? Number(numMap.get(a.r.id) ?? 0)
              : 10000 + isoWeekNum(weekA!.weekEndingFriday);
          vb =
            b.kind === "daily"
              ? Number(numMap.get(b.r.id) ?? 0)
              : 10000 + isoWeekNum(weekB!.weekEndingFriday);
          break;
        case "date":
          va = a.sortKey;
          vb = b.sortKey;
          break;
        case "type":
          va = a.kind;
          vb = b.kind;
          break;
        case "author":
          va = (dailyA?.authorLabel ?? "").toLowerCase();
          vb = (dailyB?.authorLabel ?? "").toLowerCase();
          break;
        case "weather":
          va = dailyA
            ? primaryWeatherLabel(dailyA.weather, parseDetails(dailyA.details)).toLowerCase()
            : "";
          vb = dailyB
            ? primaryWeatherLabel(dailyB.weather, parseDetails(dailyB.details)).toLowerCase()
            : "";
          break;
        case "workers":
          va = dailyA ? workerCountForDaily(dailyA) : weeklyWorkers(weekA!);
          vb = dailyB ? workerCountForDaily(dailyB) : weeklyWorkers(weekB!);
          break;
        case "status":
          va = dailyA ? (dailyA.status ?? "DRAFT") : weeklyStatus(weekA!);
          vb = dailyB ? (dailyB.status ?? "DRAFT") : weeklyStatus(weekB!);
          break;
        default:
          break;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    };
    rows.sort(cmp);
    return rows;
  }, [filtered, sortCol, sortDir, numMap]);

  function isoWeekNum(ymd: string): number {
    const d = new Date(ymd + "T12:00:00.000Z");
    const dayNr = (d.getUTCDay() + 6) % 7;
    const th = new Date(d);
    th.setUTCDate(d.getUTCDate() - dayNr + 3);
    const j4 = new Date(Date.UTC(th.getUTCFullYear(), 0, 4));
    const diff = (th.getTime() - j4.getTime()) / 86400000 - 3 + ((j4.getUTCDay() + 6) % 7);
    return 1 + Math.round(diff / 7);
  }

  const setReportQuery = useCallback(
    (id: string | null) => {
      const p = new URLSearchParams(searchParams.toString());
      if (id) p.set("report", id);
      else p.delete("report");
      const q = p.toString();
      router.replace(q ? `/projects/${projectId}/reports?${q}` : `/projects/${projectId}/reports`, {
        scroll: false,
      });
    },
    [projectId, router, searchParams],
  );

  const closeSlide = useCallback(() => {
    closingFromUiRef.current = true;
    setSlideOpen(false);
    setActiveDailyId(null);
    setActiveWeekly(null);
    setReportQuery(null);
  }, [setReportQuery]);

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFieldReport(projectId, id),
    onSuccess: async (_, id) => {
      await qc.invalidateQueries({ queryKey: qk.projectFieldReports(projectId) });
      setSelectedIds((s) => s.filter((x) => x !== id));
      if (activeDailyId === id) closeSlide();
      toast.success("Report deleted.");
    },
    onError: (e: Error) => toast.error(e.message || "Delete failed."),
  });

  function openCreate(dateYmd?: string) {
    setCreateDefaultDate(dateYmd);
    setNewModalOpen(true);
  }

  function openDaily(r: FieldReportRow) {
    closingFromUiRef.current = false;
    const row = normalizeFieldReport(r);
    setActiveDailyId(row.id);
    setActiveWeekly(null);
    setSlideOpen(true);
    setReportQuery(row.id);
    const d = parseDetails(row.details);
    setDraft(d);
    setDraftMeta({
      reportDate: row.reportDate.slice(0, 10),
      status: (row.status ?? "DRAFT") as "DRAFT" | "SUBMITTED",
      authorLabel: row.authorLabel ?? "",
      notes: row.notes ?? "",
    });
    baselineRef.current = JSON.stringify({
      details: d,
      meta: {
        reportDate: row.reportDate.slice(0, 10),
        status: row.status,
        authorLabel: row.authorLabel ?? "",
        notes: row.notes ?? "",
      },
    });
  }

  function openWeekly(w: WeeklyVirtual) {
    closingFromUiRef.current = false;
    setActiveDailyId(null);
    setActiveWeekly(w);
    setSlideOpen(true);
    setReportQuery(w.id);
  }

  useEffect(() => {
    if (closingFromUiRef.current) {
      if (!focusReportId) closingFromUiRef.current = false;
      return;
    }
    if (!focusReportId || isPending) return;
    if (slideOpen) {
      if (focusReportId.startsWith("virtual-week-")) {
        if (activeWeekly?.id === focusReportId) return;
      } else if (activeDailyId === focusReportId) {
        return;
      }
    }
    if (focusReportId.startsWith("virtual-week-")) {
      const wk = buildWeeklyVirtuals(reports).find((w) => w.id === focusReportId);
      if (wk) openWeekly(wk);
      return;
    }
    const hit = reports.find((r) => r.id === focusReportId);
    if (hit) openDaily(hit);
  }, [focusReportId, isPending, reports, slideOpen, activeDailyId, activeWeekly]);

  const dirty = useMemo(() => {
    const cur = JSON.stringify({
      details: draft,
      meta: draftMeta,
    });
    return cur !== baselineRef.current;
  }, [draft, draftMeta]);

  const activeDaily = useMemo(
    () => (activeDailyId ? (reports.find((r) => r.id === activeDailyId) ?? null) : null),
    [reports, activeDailyId],
  );

  const sendTarget = useMemo(():
    | { kind: "daily"; reportId: string; titleSuffix: string; alreadySent: boolean }
    | { kind: "weekly"; weekEndingFriday: string; titleSuffix: string; alreadySent: boolean }
    | null => {
    if (activeDaily) {
      return {
        kind: "daily",
        reportId: activeDaily.id,
        titleSuffix: ` #${numMap.get(activeDaily.id) ?? ""}`,
        alreadySent: !!activeDaily.lastEmailedAt || (activeDaily.emailSentCount ?? 0) > 0,
      };
    }
    if (activeWeekly) {
      return {
        kind: "weekly",
        weekEndingFriday: activeWeekly.weekEndingFriday,
        titleSuffix: ` ${activeWeekly.weekLabel}`,
        alreadySent: activeWeekly.days.some(
          (d) => !!d.lastEmailedAt || (d.emailSentCount ?? 0) > 0,
        ),
      };
    }
    if (selectedIds.length === 1) {
      const id = selectedIds[0]!;
      if (id.startsWith("virtual-week-")) {
        const fri = id.slice("virtual-week-".length);
        if (/^\d{4}-\d{2}-\d{2}$/.test(fri)) {
          const wk = buildWeeklyVirtuals(reports).find((w) => w.id === id);
          return {
            kind: "weekly",
            weekEndingFriday: fri,
            titleSuffix: ` ${wk?.weekLabel ?? ""}`,
            alreadySent: (wk?.days ?? []).some(
              (d) => !!d.lastEmailedAt || (d.emailSentCount ?? 0) > 0,
            ),
          };
        }
      }
      const r = reports.find((x) => x.id === id);
      if (r && (r.reportKind ?? "DAILY") === "DAILY") {
        return {
          kind: "daily",
          reportId: r.id,
          titleSuffix: ` #${numMap.get(r.id) ?? ""}`,
          alreadySent: !!r.lastEmailedAt || (r.emailSentCount ?? 0) > 0,
        };
      }
    }
    return null;
  }, [activeDaily, activeWeekly, selectedIds, reports, numMap]);

  const sendEmailMut = useMutation({
    mutationFn: async () => {
      if (!sendTarget) throw new Error("No report to send.");
      if (sendTarget.alreadySent) throw new Error("This report has already been emailed.");
      const recipients = parseRecipientEmails(sendRecipients);
      if (recipients.length === 0) throw new Error("Add at least one valid email address.");
      return sendFieldReportEmail(projectId, {
        mode: sendTarget.kind,
        reportId: sendTarget.kind === "daily" ? sendTarget.reportId : undefined,
        weekEndingFriday: sendTarget.kind === "weekly" ? sendTarget.weekEndingFriday : undefined,
        recipients,
        message: sendMessage.trim() || undefined,
        include: sendOpts,
      });
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: qk.projectFieldReports(projectId) });
      setSendModalOpen(false);
      toast.success(`Sent to ${data.sent} recipient${data.sent === 1 ? "" : "s"}.`);
    },
    onError: (e: unknown) => {
      if (e instanceof ProRequiredError) {
        toast.error("Pro subscription required.");
        return;
      }
      toast.error(e instanceof Error ? e.message : "Could not send email.");
    },
  });

  useEffect(() => {
    if (sendModalOpen && (!sendTarget || sendTarget.alreadySent)) setSendModalOpen(false);
  }, [sendModalOpen, sendTarget]);

  const reopenAsDraftMut = useMutation({
    mutationFn: async () => {
      if (!activeDailyId) throw new Error("No report selected.");
      return patchFieldReport(projectId, activeDailyId, { status: "DRAFT" });
    },
    onSuccess: async (row) => {
      qc.setQueryData<FieldReportRow[]>(qk.projectFieldReports(projectId), (old) =>
        (old ?? []).map((r) => (r.id === row.id ? normalizeFieldReport(row) : r)),
      );
      await qc.invalidateQueries({ queryKey: qk.projectFieldReports(projectId) });
      setDraftMeta((m) => ({ ...m, status: "DRAFT" }));
      toast.success("Report reopened for editing.");
    },
    onError: (e: Error) => toast.error(e.message || "Could not reopen report."),
  });

  const readOnly =
    slideOpen &&
    !!activeDailyId &&
    !activeWeekly &&
    (activeDaily?.status ?? "DRAFT") === "SUBMITTED";

  const saveDraft = useCallback(
    async (showToast: boolean) => {
      if (!activeDailyId || readOnly) return;
      const delays = draft.delays ?? [];
      const photos = draft.photos ?? [];
      const tw = sumCrewWorkers(draft);
      setSaving(true);
      try {
        const row = await patchFieldReport(projectId, activeDailyId, {
          reportDate: new Date(draftMeta.reportDate + "T12:00:00.000Z").toISOString(),
          status: draftMeta.status,
          authorLabel: draftMeta.authorLabel.trim() || null,
          notes: draftMeta.notes.trim() || null,
          details: draft,
          totalWorkers: tw,
          photoCount: photos.length,
          issueCount: delays.length,
          weather:
            primaryWeatherLabel(null, draft) === "—" ? null : primaryWeatherLabel(null, draft),
        });
        qc.setQueryData<FieldReportRow[]>(qk.projectFieldReports(projectId), (old) =>
          (old ?? []).map((r) => (r.id === row.id ? normalizeFieldReport(row) : r)),
        );
        baselineRef.current = JSON.stringify({
          details: draft,
          meta: draftMeta,
        });
        if (showToast) toast.success("Saved.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed.");
      } finally {
        setSaving(false);
      }
    },
    [activeDailyId, draft, draftMeta, projectId, qc, readOnly],
  );

  useEffect(() => {
    if (!slideOpen || !activeDailyId || readOnly) return;
    const t = window.setInterval(() => {
      if (dirty) void saveDraft(false);
    }, 30000);
    return () => window.clearInterval(t);
  }, [slideOpen, activeDailyId, readOnly, dirty, saveDraft]);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir(col === "date" || col === "num" ? "desc" : "asc");
    }
  };

  const rowIds = useMemo(
    () => sortedRows.map((row) => (row.kind === "daily" ? row.r.id : row.w.id)),
    [sortedRows],
  );
  const allSelected = rowIds.length > 0 && rowIds.every((id) => selectedIds.includes(id));
  const toggleAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(rowIds);
  };

  const padCount = Math.max(0, 10 - sortedRows.length);
  const detailPanelOpen = slideOpen && (!!activeDaily || !!activeWeekly);

  return (
    <div className={OM_PAGE_CLASS}>
      <OmSubPageHeader
        icon={ScrollText}
        title="Field reports"
        description="Daily logs and weekly rollups for this project."
        action={
          <>
            <EnterpriseButton
              size="sm"
              variant="secondary"
              onClick={() => exportFieldReportsCsv(project?.name ?? "project", sortedRows, numMap)}
            >
              <Download className="h-4 w-4" strokeWidth={1.75} />
              Export
            </EnterpriseButton>
            <EnterpriseButton size="sm" onClick={() => openCreate()}>
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              New report
            </EnterpriseButton>
          </>
        }
      />

      {!isPending ? (
        <FieldReportsOverview
          rows={reports}
          filter={overviewFilter}
          onFilterChange={onOverviewFilterChange}
        />
      ) : null}

      {overviewFilter === "MISSING" && missingDateKeys.length > 0 ? (
        <div className="enterprise-alert-warning rounded-xl border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-4 py-3 shadow-[var(--enterprise-shadow-xs)]">
          <p className="text-sm font-semibold text-[var(--enterprise-semantic-danger-text)]">
            Missing daily reports ({missingDateKeys.length} day
            {missingDateKeys.length === 1 ? "" : "s"} in the last 14)
          </p>
          <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
            No daily log filed for these dates. Create a report to fill the gap.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {missingDateKeys.map((ymd) => (
              <li key={ymd}>
                <EnterpriseButton size="sm" variant="secondary" onClick={() => openCreate(ymd)}>
                  <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  {formatReportTableDate(ymd + "T12:00:00.000Z")}
                </EnterpriseButton>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {selectedIds.length > 0 ? (
        <div
          className="sticky top-0 z-20 flex flex-col gap-3 rounded-xl border border-[var(--enterprise-primary)]/20 bg-[var(--enterprise-primary)]/10 px-4 py-3 shadow-[var(--enterprise-shadow-xs)] sm:flex-row sm:items-center sm:justify-between"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
        >
          <p className="text-sm font-semibold text-[var(--enterprise-primary)]">
            {selectedIds.length} report{selectedIds.length === 1 ? "" : "s"} selected
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <EnterpriseButton
              size="sm"
              variant="secondary"
              onClick={() => {
                const subset = sortedRows.filter((row) =>
                  selectedIds.includes(row.kind === "daily" ? row.r.id : row.w.id),
                );
                exportFieldReportsCsv(project?.name ?? "project", subset, numMap);
                toast.success("Exported CSV.");
              }}
            >
              Export CSV
            </EnterpriseButton>
            <EnterpriseButton
              size="sm"
              variant="secondary"
              disabled={!sendTarget || sendTarget.alreadySent}
              title={
                !sendTarget
                  ? "Select exactly one report in the table, or open a report in the side panel."
                  : sendTarget.alreadySent
                    ? "This report was already sent to client."
                    : undefined
              }
              onClick={() => {
                if (!sendTarget) {
                  toast.error(
                    "Select one report in the table, or open a report in the side panel first.",
                  );
                  return;
                }
                if (sendTarget.alreadySent) {
                  toast.error("This report has already been sent to client.");
                  return;
                }
                setSendModalOpen(true);
              }}
            >
              Send to Client
            </EnterpriseButton>
            <EnterpriseButton
              size="sm"
              variant="danger"
              onClick={() => {
                const real = selectedIds.filter((id) => !id.startsWith("virtual-week-"));
                if (
                  !window.confirm(
                    `Delete ${real.length} report(s)? Weekly summaries are not stored and will reappear when dailies exist.`,
                  )
                )
                  return;
                void (async () => {
                  for (const id of real) {
                    try {
                      await deleteFieldReport(projectId, id);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Delete failed");
                      break;
                    }
                  }
                  await qc.invalidateQueries({ queryKey: qk.projectFieldReports(projectId) });
                  setSelectedIds([]);
                  closeSlide();
                  toast.success("Deleted selected reports.");
                })();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
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
      ) : reports.length > 0 ? (
        <section className="enterprise-card flex flex-col gap-2 p-3 sm:p-4">
          <StatusFilterChips
            defs={STATUS_FILTER_DEFS}
            value={filterStatus}
            onChange={(key) => {
              setFilterStatus(key);
              if (key === "ALL") {
                if (overviewFilter === "DRAFT" || overviewFilter === "SUBMITTED") {
                  setOverviewFilter("ALL");
                }
              } else {
                setOverviewFilter(key);
              }
            }}
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
                placeholder="Search reports…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={OM_COMPACT_SELECT}
              />
            </label>
            <div
              className="inline-flex flex-wrap gap-1 rounded-lg border border-[var(--enterprise-border)] p-0.5"
              role="group"
              aria-label="Report type"
            >
              {TYPE_CHIP_DEFS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={filterType === t.key}
                  onClick={() => {
                    setFilterType(t.key);
                    if (t.key === "DAILY" || t.key === "WEEKLY") setOverviewFilter(t.key);
                    else if (overviewFilter === "DAILY" || overviewFilter === "WEEKLY") {
                      setOverviewFilter("ALL");
                    }
                  }}
                  className={`inline-flex min-h-7 items-center rounded-md px-2.5 text-[11px] font-semibold ${
                    filterType === t.key ? OM_COMPACT_CHIP_ACTIVE : OM_COMPACT_CHIP_IDLE
                  }`}
                  style={
                    filterType === t.key
                      ? { backgroundColor: "var(--enterprise-primary)" }
                      : undefined
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
            <label className="min-w-[8rem]">
              <span className={FILTER_LABEL_CLASS}>Written by</span>
              <select
                value={filterAuthor}
                onChange={(e) => setFilterAuthor(e.target.value)}
                className={OM_COMPACT_SELECT}
              >
                <option value="ALL">All authors</option>
                {authorOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-[8rem]">
              <span className={FILTER_LABEL_CLASS}>From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={OM_COMPACT_SELECT}
                aria-label="From date"
              />
            </label>
            <label className="min-w-[8rem]">
              <span className={FILTER_LABEL_CLASS}>To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={OM_COMPACT_SELECT}
                aria-label="To date"
              />
            </label>
          </div>
        </section>
      ) : null}

      {isPending ? (
        <div className="py-16">
          <EnterpriseLoadingState
            variant="minimal"
            message="Loading field reports…"
            label="Loading"
          />
        </div>
      ) : reports.length === 0 && overviewFilter !== "MISSING" ? (
        <OmEmptyState
          icon={ScrollText}
          title="No field reports yet"
          description="Create a daily report to start logging weather, crews, and site progress."
          action={
            <EnterpriseButton size="sm" onClick={() => openCreate()}>
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              New report
            </EnterpriseButton>
          }
        />
      ) : (
        <div
          className="mobile-table-wrap enterprise-card -mx-4 overflow-x-auto sm:mx-0"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="inline-block min-w-full align-middle">
            <table className="w-full min-w-[880px] border-collapse md:min-w-[960px]">
              <thead>
                <tr className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]">
                  <th className="w-10 px-2 py-2 text-left">
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
                      active={sortCol === "num"}
                      dir={sortDir}
                      onToggle={() => toggleSort("num")}
                    />
                  </th>
                  <th className="min-w-[120px] px-3 py-2 text-left">
                    <SortHeader
                      label="Date"
                      active={sortCol === "date"}
                      dir={sortDir}
                      onToggle={() => toggleSort("date")}
                    />
                  </th>
                  <th className="min-w-[88px] px-3 py-2 text-left">
                    <SortHeader
                      label="Type"
                      active={sortCol === "type"}
                      dir={sortDir}
                      onToggle={() => toggleSort("type")}
                    />
                  </th>
                  <th className="min-w-[120px] px-3 py-2 text-left">
                    <SortHeader
                      label="Written by"
                      active={sortCol === "author"}
                      dir={sortDir}
                      onToggle={() => toggleSort("author")}
                    />
                  </th>
                  <th className="min-w-[120px] px-3 py-2 text-left">
                    <SortHeader
                      label="Weather"
                      active={sortCol === "weather"}
                      dir={sortDir}
                      onToggle={() => toggleSort("weather")}
                    />
                  </th>
                  <th className="min-w-[88px] px-3 py-2 text-left">
                    <SortHeader
                      label="Workers"
                      active={sortCol === "workers"}
                      dir={sortDir}
                      onToggle={() => toggleSort("workers")}
                    />
                  </th>
                  <th className="min-w-[100px] px-3 py-2 text-left">
                    <SortHeader
                      label="Status"
                      active={sortCol === "status"}
                      dir={sortDir}
                      onToggle={() => toggleSort("status")}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-[var(--enterprise-text-muted)]"
                    >
                      {overviewFilter === "MISSING"
                        ? "Use the dates above to create missing daily reports."
                        : "No reports match your filters."}
                    </td>
                  </tr>
                ) : (
                  sortedRows.map(
                    // fallow-ignore-next-line complexity
                    (row) => {
                      const id = row.kind === "daily" ? row.r.id : row.w.id;
                      const sel = selectedIds.includes(id);
                      const active =
                        slideOpen &&
                        (row.kind === "daily"
                          ? activeDailyId === row.r.id
                          : activeWeekly?.id === row.w.id);
                      const hi = sel || active;
                      if (row.kind === "daily") {
                        const r = row.r;
                        const wx = primaryWeatherLabel(r.weather, parseDetails(r.details));
                        const st = (r.status ?? "DRAFT") as "DRAFT" | "SUBMITTED";
                        return (
                          <tr
                            key={r.id}
                            onClick={() => openDaily(r)}
                            className={`mobile-tappable-row min-h-14 cursor-pointer border-b border-[var(--enterprise-border)] text-sm transition-colors last:border-b-0 active:scale-[0.99] ${
                              hi
                                ? "border-l-[3px] border-l-[var(--enterprise-primary)] bg-[var(--enterprise-primary)]/8"
                                : "hover:bg-[var(--enterprise-hover-surface)]"
                            }`}
                            style={{ height: 44 }}
                          >
                            <td className="px-2" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-[var(--enterprise-border)]"
                                checked={sel}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setSelectedIds((ids) =>
                                    e.target.checked ? [...ids, id] : ids.filter((x) => x !== id),
                                  );
                                }}
                              />
                            </td>
                            <td className="px-3 font-mono text-xs font-semibold text-[var(--enterprise-primary)]">
                              {numMap.get(r.id) ?? "—"}
                            </td>
                            <td className="whitespace-nowrap px-3 text-[var(--enterprise-text)]">
                              {formatReportTableDate(r.reportDate)}
                            </td>
                            <td className="px-3">
                              <span className="rounded-md border border-[var(--enterprise-semantic-info-border)] bg-[var(--enterprise-semantic-info-bg)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--enterprise-semantic-info-text)]">
                                Daily
                              </span>
                            </td>
                            <td className="max-w-[140px] truncate px-3 text-[var(--enterprise-text)]">
                              {r.authorLabel?.trim() || "—"}
                            </td>
                            <td className="px-3">
                              <div className="flex items-center gap-2 text-[var(--enterprise-text)]">
                                {wx === "—" ? <span>—</span> : <WeatherIcon text={wx} />}
                                <span className="truncate">{wx === "—" ? "" : wx}</span>
                              </div>
                            </td>
                            <td className="px-3 tabular-nums text-[var(--enterprise-text)]">
                              {workerCountForDaily(r)}
                            </td>
                            <td className="px-3">
                              <div className="flex items-center gap-1">
                                <span
                                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${fieldReportStatusBadgeClass(st)}`}
                                >
                                  {FIELD_REPORT_STATUS_LABEL[st] ?? st}
                                </span>
                                {!!r.lastEmailedAt || (r.emailSentCount ?? 0) > 0 ? (
                                  <span className="rounded-md border border-[var(--enterprise-semantic-info-border)] bg-[var(--enterprise-semantic-info-bg)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--enterprise-semantic-info-text)]">
                                    Sent
                                  </span>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      const w = row.w;
                      const st = weeklyStatus(w);
                      return (
                        <tr
                          key={w.id}
                          onClick={() => openWeekly(w)}
                          className={`mobile-tappable-row min-h-14 cursor-pointer border-b border-[var(--enterprise-border)] text-sm transition-colors last:border-b-0 active:scale-[0.99] ${
                            hi
                              ? "border-l-[3px] border-l-[var(--enterprise-primary)] bg-[var(--enterprise-primary)]/8"
                              : "hover:bg-[var(--enterprise-hover-surface)]"
                          }`}
                          style={{ height: 44 }}
                        >
                          <td className="px-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-[var(--enterprise-border)]"
                              checked={sel}
                              onChange={(e) => {
                                e.stopPropagation();
                                setSelectedIds((ids) =>
                                  e.target.checked ? [...ids, id] : ids.filter((x) => x !== id),
                                );
                              }}
                            />
                          </td>
                          <td className="px-3 font-mono text-xs font-semibold text-[var(--enterprise-primary)]">
                            {w.weekLabel}
                          </td>
                          <td className="whitespace-nowrap px-3 text-[var(--enterprise-text)]">
                            {formatWeekEndingLabel(w.weekEndingFriday)}
                          </td>
                          <td className="px-3">
                            <span className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--enterprise-text-muted)]">
                              Weekly
                            </span>
                          </td>
                          <td className="px-3 text-[var(--enterprise-text)]">Auto</td>
                          <td className="px-3 text-[var(--enterprise-text)]">—</td>
                          <td className="px-3 tabular-nums text-[var(--enterprise-text)]">
                            {weeklyWorkers(w)}
                          </td>
                          <td className="px-3">
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${fieldReportStatusBadgeClass(st)}`}
                            >
                              {FIELD_REPORT_STATUS_LABEL[st] ?? st}
                            </span>
                          </td>
                        </tr>
                      );
                    },
                  )
                )}
                {Array.from({ length: padCount }).map((_, i) => (
                  <tr
                    key={`pad-${i}`}
                    className="border-b border-[var(--enterprise-border)]/60"
                    style={{ height: 44 }}
                  >
                    <td colSpan={8} className="bg-[var(--enterprise-hover-surface)]/40" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail slider — single panel (daily or weekly) */}
      <EnterpriseSlideOver
        open={detailPanelOpen}
        onClose={closeSlide}
        panelVariant="floating"
        closeOnBackdrop={false}
        panelMaxWidthClass="max-w-[min(100dvw,560px)] sm:max-w-[560px]"
        panelChromeClassName="border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-floating)]"
        bodyClassName={SLIDER_BODY}
        footerClassName="border-t border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-4 sm:px-5"
        ariaLabelledBy={activeWeekly ? weeklyTitleId : newTitleId}
        header={
          activeWeekly ? (
            <div>
              <p
                id={weeklyTitleId}
                className="text-base font-semibold tracking-tight text-[var(--enterprise-text)]"
              >
                {`${activeWeekly.weekLabel} — ${formatWeekEndingLabel(activeWeekly.weekEndingFriday)}`}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
                Auto-generated from daily reports in this work week.
              </p>
            </div>
          ) : (
            <div>
              <p
                id={newTitleId}
                className="text-base font-semibold tracking-tight text-[var(--enterprise-text)]"
              >
                Field Report #{activeDaily ? (numMap.get(activeDaily.id) ?? "—") : ""}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
                Daily · {activeDaily ? formatReportTableDate(activeDaily.reportDate) : ""}
              </p>
              {activeDaily ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-semibold ${fieldReportStatusBadgeClass(activeDaily.status)}`}
                  >
                    {FIELD_REPORT_STATUS_LABEL[activeDaily.status ?? "DRAFT"] ??
                      activeDaily.status ??
                      "Draft"}
                  </span>
                  {!!activeDaily.lastEmailedAt || (activeDaily.emailSentCount ?? 0) > 0 ? (
                    <span className="inline-flex items-center rounded-md border border-[var(--enterprise-semantic-info-border)] bg-[var(--enterprise-semantic-info-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--enterprise-semantic-info-text)]">
                      Sent to client
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        }
        footer={
          activeWeekly ? (
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <EnterpriseButton
                type="button"
                variant="secondary"
                onClick={() => toast.message("Weekly PDF export is coming soon.")}
              >
                <Download className="h-4 w-4" strokeWidth={1.75} />
                Download Weekly PDF
              </EnterpriseButton>
              <EnterpriseButton
                type="button"
                disabled={!sendTarget || sendTarget.alreadySent}
                onClick={() => {
                  if (!sendTarget || sendTarget.alreadySent) return;
                  setSendModalOpen(true);
                }}
              >
                Send to Client
              </EnterpriseButton>
            </div>
          ) : (
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {!readOnly && activeDailyId ? (
                  <EnterpriseButton
                    type="button"
                    variant="danger"
                    onClick={() => {
                      if (!window.confirm("Delete this report?")) return;
                      deleteMut.mutate(activeDailyId);
                    }}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                    Delete
                  </EnterpriseButton>
                ) : null}
              </div>
              <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:gap-2">
                <EnterpriseButton
                  type="button"
                  variant="secondary"
                  disabled={!sendTarget || sendTarget.alreadySent}
                  onClick={() => {
                    if (!sendTarget || sendTarget.alreadySent) return;
                    setSendModalOpen(true);
                  }}
                >
                  <Send className="h-4 w-4" strokeWidth={1.75} />
                  Send to Client
                </EnterpriseButton>
                {readOnly ? (
                  <EnterpriseButton
                    type="button"
                    variant="secondary"
                    loading={reopenAsDraftMut.isPending}
                    onClick={() => void reopenAsDraftMut.mutate()}
                  >
                    {reopenAsDraftMut.isPending ? "Reopening…" : "Reopen as Draft"}
                  </EnterpriseButton>
                ) : null}
                {!readOnly ? (
                  <EnterpriseButton
                    type="button"
                    disabled={saving || !dirty}
                    loading={saving}
                    onClick={() => void saveDraft(true)}
                  >
                    Save
                  </EnterpriseButton>
                ) : null}
              </div>
            </div>
          )
        }
      >
        {activeWeekly ? (
          <WeeklySummaryBody w={activeWeekly} />
        ) : activeDaily ? (
          <div className="space-y-5 text-[15px] leading-relaxed text-[var(--enterprise-text)]">
            {readOnly ? (
              <div className="rounded-2xl border border-[var(--enterprise-semantic-warning-border)] bg-[var(--enterprise-semantic-warning-bg)] px-4 py-3.5 text-sm text-[var(--enterprise-semantic-warning-text)] shadow-[var(--enterprise-shadow-xs)]">
                <p className="font-semibold">Submitted report</p>
                <p className="mt-1 text-xs leading-relaxed opacity-90">
                  Fields are read-only. Use <span className="font-semibold">Reopen as Draft</span>{" "}
                  in the bar below to unlock editing.
                </p>
              </div>
            ) : null}
            {!!activeDaily.lastEmailedAt || (activeDaily.emailSentCount ?? 0) > 0 ? (
              <div className="rounded-2xl border border-[var(--enterprise-semantic-info-border)] bg-[var(--enterprise-semantic-info-bg)] px-4 py-3.5 text-sm text-[var(--enterprise-semantic-info-text)] shadow-[var(--enterprise-shadow-xs)]">
                <p className="font-semibold">Already emailed</p>
                <p className="mt-1 text-xs leading-relaxed opacity-90">
                  Sending again is disabled to avoid duplicates. You can still update the report
                  content.
                </p>
              </div>
            ) : null}

            <SliderSectionCard
              kicker="Basics"
              title="Report details"
              icon={<ClipboardList className="h-4 w-4" strokeWidth={1.75} />}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={MOBILE_FIELD_LABEL}>Report type</label>
                  <select disabled={readOnly} className={MOBILE_FIELD_SELECT}>
                    <option>Daily</option>
                  </select>
                </div>
                <div>
                  <label className={MOBILE_FIELD_LABEL}>Written by</label>
                  <input
                    disabled={readOnly}
                    value={draftMeta.authorLabel}
                    onChange={(e) => setDraftMeta((m) => ({ ...m, authorLabel: e.target.value }))}
                    className={MOBILE_FIELD_INPUT}
                  />
                </div>
                <div>
                  <label className={MOBILE_FIELD_LABEL}>Report date</label>
                  <input
                    type="date"
                    disabled={readOnly}
                    value={draftMeta.reportDate}
                    onChange={(e) => setDraftMeta((m) => ({ ...m, reportDate: e.target.value }))}
                    className={MOBILE_FIELD_INPUT}
                  />
                </div>
                <div>
                  <label className={MOBILE_FIELD_LABEL}>Status</label>
                  <select
                    disabled={readOnly}
                    value={draftMeta.status}
                    onChange={(e) =>
                      setDraftMeta((m) => ({
                        ...m,
                        status: e.target.value as "DRAFT" | "SUBMITTED",
                      }))
                    }
                    className={MOBILE_FIELD_SELECT}
                  >
                    <option value="DRAFT">{FIELD_REPORT_STATUS_LABEL.DRAFT}</option>
                    <option value="SUBMITTED">{FIELD_REPORT_STATUS_LABEL.SUBMITTED}</option>
                  </select>
                </div>
              </div>
            </SliderSectionCard>

            <SliderSectionCard
              kicker="Site conditions"
              title="Weather"
              icon={<CloudSun className="h-4 w-4 text-sky-600" strokeWidth={1.75} />}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-3">
                  <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">
                    Morning
                  </p>
                  <div className="flex min-w-0 gap-2">
                    <select
                      disabled={readOnly}
                      className={`${SLIDER_INPUT} min-w-0 flex-1 px-2`}
                      value={draft.weather?.morning?.condition ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          weather: {
                            ...d.weather,
                            morning: { ...d.weather?.morning, condition: e.target.value },
                          },
                        }))
                      }
                    >
                      <option value="">—</option>
                      {WEATHER_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                    <input
                      disabled={readOnly}
                      type="number"
                      placeholder="°C"
                      className={`${SLIDER_INPUT} w-[4.25rem] shrink-0 px-2 text-center tabular-nums`}
                      value={draft.weather?.morning?.tempC ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          weather: {
                            ...d.weather,
                            morning: {
                              ...d.weather?.morning,
                              tempC: e.target.value === "" ? null : Number(e.target.value),
                            },
                          },
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-3">
                  <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">
                    Afternoon
                  </p>
                  <div className="flex min-w-0 gap-2">
                    <select
                      disabled={readOnly}
                      className={`${SLIDER_INPUT} min-w-0 flex-1 px-2`}
                      value={draft.weather?.afternoon?.condition ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          weather: {
                            ...d.weather,
                            afternoon: { ...d.weather?.afternoon, condition: e.target.value },
                          },
                        }))
                      }
                    >
                      <option value="">—</option>
                      {WEATHER_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                    <input
                      disabled={readOnly}
                      type="number"
                      placeholder="°C"
                      className={`${SLIDER_INPUT} w-[4.25rem] shrink-0 px-2 text-center tabular-nums`}
                      value={draft.weather?.afternoon?.tempC ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          weather: {
                            ...d.weather,
                            afternoon: {
                              ...d.weather?.afternoon,
                              tempC: e.target.value === "" ? null : Number(e.target.value),
                            },
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className={MOBILE_FIELD_LABEL}>Work conditions</label>
                <select
                  disabled={readOnly}
                  className={MOBILE_FIELD_SELECT}
                  value={draft.weather?.workConditions ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      weather: { ...d.weather, workConditions: e.target.value },
                    }))
                  }
                >
                  <option value="">—</option>
                  {WORK_CONDITIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            </SliderSectionCard>

            <CrewSection draft={draft} setDraft={setDraft} readOnly={readOnly} />
            <LineSection
              title="Work completed"
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" strokeWidth={1.75} />}
              keyName="workCompleted"
              draft={draft}
              setDraft={setDraft}
              readOnly={readOnly}
              addLabel="Add item"
            />
            <LineSection
              title="Work in progress"
              icon={<RefreshCw className="h-4 w-4 text-sky-600" strokeWidth={1.75} />}
              keyName="workInProgress"
              draft={draft}
              setDraft={setDraft}
              readOnly={readOnly}
              showPercent
              addLabel="Add item"
            />
            <DelaySection
              draft={draft}
              setDraft={setDraft}
              readOnly={readOnly}
              projectId={projectId}
            />
            <LineSection
              title="Materials delivered"
              icon={<Package className="h-4 w-4 text-amber-700" strokeWidth={1.75} />}
              keyName="materials"
              draft={draft}
              setDraft={setDraft}
              readOnly={readOnly}
              addLabel="Add delivery"
            />
            <LineSection
              title="Visitors"
              icon={<UserRound className="h-4 w-4 text-slate-600" strokeWidth={1.75} />}
              keyName="visitors"
              draft={draft}
              setDraft={setDraft}
              readOnly={readOnly}
              addLabel="Add visitor"
            />
            <PhotoSection draft={draft} setDraft={setDraft} readOnly={readOnly} />
            <SliderSectionCard
              kicker="Client-facing"
              title="General notes"
              icon={<ScrollText className="h-4 w-4 text-slate-600" strokeWidth={1.75} />}
            >
              <textarea
                disabled={readOnly}
                rows={5}
                value={draftMeta.notes}
                onChange={(e) => setDraftMeta((m) => ({ ...m, notes: e.target.value }))}
                className={MOBILE_FIELD_TEXTAREA}
                placeholder="Notes for the client team…"
              />
            </SliderSectionCard>
          </div>
        ) : null}
      </EnterpriseSlideOver>

      <FieldReportCreateSlideOver
        open={newModalOpen}
        onClose={() => {
          setNewModalOpen(false);
          setCreateDefaultDate(undefined);
        }}
        projectId={projectId}
        members={memberNames}
        defaultAuthor={defaultAuthor}
        defaultDate={createDefaultDate}
        onCreated={(row) => openDaily(normalizeFieldReport(row))}
      />

      {/* Send modal — portaled above slide-over shell */}
      {sendModalOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="mobile-sheet-host fixed inset-0 z-[201] flex items-center justify-center p-4 max-lg:items-end max-lg:p-0">
              <button
                type="button"
                className="absolute inset-0 bg-[var(--enterprise-text)]/40 backdrop-blur-[1px]"
                aria-label="Close"
                onClick={() => setSendModalOpen(false)}
              />
              <div
                className="relative z-10 w-full max-w-md rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5 shadow-[var(--enterprise-shadow-floating)]"
                role="dialog"
                aria-label="Send report"
              >
                <div className="mb-4 flex items-start justify-between">
                  <h2 className="text-lg font-semibold text-[var(--enterprise-text)]">
                    Send Report
                    {sendTarget?.titleSuffix ?? ""}
                  </h2>
                  <button
                    type="button"
                    className="rounded-lg p-1 text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)]"
                    onClick={() => setSendModalOpen(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <label className={MOBILE_FIELD_LABEL}>Recipients</label>
                    <input
                      value={sendRecipients}
                      onChange={(e) => setSendRecipients(e.target.value)}
                      className={MOBILE_FIELD_INPUT}
                      placeholder="client@example.com, pm@example.com"
                    />
                    <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
                      Separate multiple addresses with commas, spaces, or semicolons.
                    </p>
                  </div>
                  <div>
                    <label className={MOBILE_FIELD_LABEL}>Message (optional)</label>
                    <textarea
                      value={sendMessage}
                      onChange={(e) => setSendMessage(e.target.value)}
                      rows={3}
                      className={MOBILE_FIELD_TEXTAREA}
                      placeholder="Daily report for Tower Block A — …"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-[var(--enterprise-text-muted)]">
                      Include
                    </p>
                    {(
                      [
                        ["weather", "Weather summary"],
                        ["workers", "Worker counts"],
                        ["completed", "Work completed"],
                        ["delays", "Delays and issues"],
                        ["photos", "Photos"],
                        ["materials", "Materials delivered"],
                      ] as const
                    ).map(([k, label]) => (
                      <label
                        key={k}
                        className="flex items-center gap-2 py-0.5 text-[var(--enterprise-text)]"
                      >
                        <input
                          type="checkbox"
                          checked={sendOpts[k as keyof typeof sendOpts]}
                          onChange={(e) =>
                            setSendOpts((o) => ({ ...o, [k]: e.target.checked }) as typeof sendOpts)
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
                    The email uses the last saved version of each report on the server (unsaved
                    edits in the panel are not included).
                  </p>
                  {sendTarget?.alreadySent ? (
                    <p className="text-xs font-medium text-[var(--enterprise-semantic-warning-text)]">
                      This report was already sent to client and cannot be sent again.
                    </p>
                  ) : null}
                  <div className="flex justify-end gap-2 pt-2">
                    <EnterpriseButton
                      type="button"
                      variant="secondary"
                      onClick={() => setSendModalOpen(false)}
                    >
                      Cancel
                    </EnterpriseButton>
                    <EnterpriseButton
                      type="button"
                      loading={sendEmailMut.isPending}
                      disabled={
                        sendEmailMut.isPending ||
                        !sendRecipients.trim() ||
                        parseRecipientEmails(sendRecipients).length === 0 ||
                        !sendTarget ||
                        sendTarget.alreadySent
                      }
                      onClick={() => void sendEmailMut.mutate()}
                    >
                      {sendEmailMut.isPending ? "Sending…" : "Send Report →"}
                    </EnterpriseButton>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function WeeklySummaryBody({ w }: { w: WeeklyVirtual }) {
  const workingDays = w.days.length;
  const totalWorkers = weeklyWorkers(w);
  const avg = workingDays ? Math.round(totalWorkers / workingDays) : 0;
  const issues = w.days.reduce((a, d) => a + (d.issueCount ?? 0), 0);
  const deliveries = w.days.reduce(
    (a, d) => a + (parseDetails(d.details).materials?.length ?? 0),
    0,
  );
  const photos = w.days.reduce((a, d) => a + (d.photoCount ?? 0), 0);
  const allSubmitted = weeklyStatus(w) === "SUBMITTED";
  return (
    <div className="space-y-5 text-[15px] leading-relaxed text-[var(--enterprise-text)]">
      <SliderSectionCard
        kicker="Roll-up"
        title="Week at a glance"
        icon={
          <ScrollText className="h-4 w-4 text-[var(--enterprise-text-muted)]" strokeWidth={1.75} />
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[var(--enterprise-hover-surface)] px-3.5 py-3 ring-1 ring-inset ring-[var(--enterprise-border)]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              Working days
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--enterprise-text)]">
              {workingDays}
            </p>
          </div>
          <div className="rounded-xl bg-[var(--enterprise-hover-surface)] px-3.5 py-3 ring-1 ring-inset ring-[var(--enterprise-border)]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              Workers (total)
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--enterprise-text)]">
              {totalWorkers}
            </p>
            <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">Avg {avg} / day</p>
          </div>
          <div className="rounded-xl bg-[var(--enterprise-hover-surface)] px-3.5 py-3 ring-1 ring-inset ring-[var(--enterprise-border)]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              Dailies filed
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--enterprise-text)]">
              {workingDays}
              <span className="text-sm font-medium text-[var(--enterprise-text-muted)]"> / 5</span>
            </p>
            <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
              {allSubmitted ? "All submitted" : "Includes drafts"}
            </p>
          </div>
        </div>
      </SliderSectionCard>

      <SliderSectionCard
        kicker="By day"
        title="Daily breakdown"
        icon={
          <CalendarDays
            className="h-4 w-4 text-[var(--enterprise-text-muted)]"
            strokeWidth={1.75}
          />
        }
      >
        <ul className="space-y-2.5">
          {w.days.map((d) => {
            const wx = primaryWeatherLabel(d.weather, parseDetails(d.details));
            const delayHint = (parseDetails(d.details).delays?.length ?? 0) > 0;
            return (
              <li
                key={d.id}
                className="flex flex-col gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--enterprise-text)]">
                    {formatReportTableDate(d.reportDate)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[var(--enterprise-text-muted)]">
                    {wx === "—" ? "—" : wx}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <span className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-[var(--enterprise-text-muted)] ring-1 ring-[var(--enterprise-border)]">
                    {workerCountForDaily(d)} workers
                  </span>
                  {delayHint ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200/80">
                      <AlertTriangle className="h-3 w-3 shrink-0" strokeWidth={2} />
                      Delays
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900 ring-1 ring-emerald-200/80">
                      <CheckCircle2 className="h-3 w-3 shrink-0" strokeWidth={2} />
                      On track
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </SliderSectionCard>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={`${SLIDER_CARD} py-3.5 text-center text-sm`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
            Issues
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--enterprise-text)]">
            {issues}
          </p>
        </div>
        <div className={`${SLIDER_CARD} py-3.5 text-center text-sm`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
            Deliveries
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--enterprise-text)]">
            {deliveries}
          </p>
        </div>
        <div className={`${SLIDER_CARD} py-3.5 text-center text-sm`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
            Photos
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--enterprise-text)]">
            {photos}
          </p>
        </div>
      </div>
    </div>
  );
}

function CrewSection({
  draft,
  setDraft,
  readOnly,
}: {
  draft: FieldReportDetails;
  setDraft: Dispatch<SetStateAction<FieldReportDetails>>;
  readOnly: boolean;
}) {
  const crews = draft.crews ?? [];
  const total = sumCrewWorkers(draft);
  return (
    <SliderSectionCard
      kicker="Labour"
      title="Workers on site"
      icon={
        <UsersRound className="h-4 w-4 text-[var(--enterprise-text-muted)]" strokeWidth={1.75} />
      }
    >
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
        <span>Crew</span>
        <span className="text-center">Count</span>
        <span />
      </div>
      {crews.map((c) => (
        <div key={c.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
          <input
            disabled={readOnly}
            value={c.name}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                crews: (d.crews ?? []).map((x) =>
                  x.id === c.id ? { ...x, name: e.target.value } : x,
                ),
              }))
            }
            className={`${SLIDER_INPUT} min-w-0`}
          />
          <input
            disabled={readOnly}
            type="number"
            min={0}
            className={`${SLIDER_INPUT} w-[4.25rem] px-2 text-center tabular-nums`}
            value={c.workers}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                crews: (d.crews ?? []).map((x) =>
                  x.id === c.id ? { ...x, workers: Number(e.target.value) || 0 } : x,
                ),
              }))
            }
          />
          {!readOnly ? (
            <button
              type="button"
              className="rounded-xl p-2 text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-red-600"
              aria-label="Remove crew"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  crews: (d.crews ?? []).filter((x) => x.id !== c.id),
                }))
              }
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </button>
          ) : (
            <span />
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--enterprise-border)]/60 pt-3">
        <p className="text-sm font-semibold text-[var(--enterprise-text-muted)]">
          Total <span className="tabular-nums text-[var(--enterprise-text)]">{total}</span> workers
        </p>
        {!readOnly ? (
          <button
            type="button"
            className="text-sm font-semibold text-[var(--enterprise-primary)] hover:underline"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                crews: [...(d.crews ?? []), { id: nanoid(), name: "", workers: 0 }],
              }))
            }
          >
            + Add crew
          </button>
        ) : null}
      </div>
    </SliderSectionCard>
  );
}

function LineSection({
  title,
  icon,
  keyName,
  draft,
  setDraft,
  readOnly,
  showPercent,
  addLabel,
}: {
  title: string;
  icon: ReactNode;
  keyName: "workCompleted" | "workInProgress" | "materials" | "visitors";
  draft: FieldReportDetails;
  setDraft: Dispatch<SetStateAction<FieldReportDetails>>;
  readOnly: boolean;
  showPercent?: boolean;
  addLabel: string;
}) {
  const items = (draft[keyName] ?? []) as { id: string; text: string; percent?: number }[];
  return (
    <SliderSectionCard kicker="Site log" title={title} icon={icon}>
      <ul className="space-y-2.5">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex items-start gap-2 rounded-xl bg-[var(--enterprise-hover-surface)] p-2 ring-1 ring-inset ring-[var(--enterprise-border)]"
          >
            <input
              disabled={readOnly}
              value={it.text}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  [keyName]: (d[keyName] as typeof items).map((x) =>
                    x.id === it.id ? { ...x, text: e.target.value } : x,
                  ),
                }))
              }
              className={`${SLIDER_INPUT} min-w-0 flex-1 border-[var(--enterprise-border)] bg-white`}
            />
            {showPercent ? (
              <input
                disabled={readOnly}
                type="number"
                min={0}
                max={100}
                placeholder="%"
                className={`${SLIDER_INPUT} w-[4.25rem] shrink-0 border-[var(--enterprise-border)] bg-white px-2 text-center tabular-nums`}
                value={it.percent ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    [keyName]: (d[keyName] as typeof items).map((x) =>
                      x.id === it.id
                        ? {
                            ...x,
                            percent: e.target.value === "" ? undefined : Number(e.target.value),
                          }
                        : x,
                    ),
                  }))
                }
              />
            ) : null}
            {!readOnly ? (
              <button
                type="button"
                className="rounded-xl p-2 text-[var(--enterprise-text-muted)] transition hover:bg-white hover:text-red-600"
                aria-label="Remove"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    [keyName]: (d[keyName] as typeof items).filter((x) => x.id !== it.id),
                  }))
                }
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {!readOnly ? (
        <button
          type="button"
          className="text-sm font-semibold text-[var(--enterprise-primary)] hover:underline"
          onClick={() =>
            setDraft((d) => ({
              ...d,
              [keyName]: [...((d[keyName] ?? []) as typeof items), { id: nanoid(), text: "" }],
            }))
          }
        >
          + {addLabel}
        </button>
      ) : null}
    </SliderSectionCard>
  );
}

function DelaySection({
  draft,
  setDraft,
  readOnly,
  projectId,
}: {
  draft: FieldReportDetails;
  setDraft: Dispatch<SetStateAction<FieldReportDetails>>;
  readOnly: boolean;
  projectId: string;
}) {
  const delays = draft.delays ?? [];
  return (
    <SliderSectionCard
      kicker="Risks"
      title="Delays & issues"
      icon={<AlertTriangle className="h-4 w-4 text-amber-600" strokeWidth={1.75} />}
    >
      <ul className="space-y-3">
        {delays.map((it) => (
          <li
            key={it.id}
            className="space-y-3 rounded-xl border border-amber-100/90 bg-gradient-to-br from-amber-50/40 via-white to-white p-3.5 shadow-sm shadow-amber-900/[0.03]"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                className="mt-2.5 h-4 w-4 shrink-0 text-amber-600"
                strokeWidth={1.75}
              />
              <input
                disabled={readOnly}
                value={it.text}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    delays: (d.delays ?? []).map((x) =>
                      x.id === it.id ? { ...x, text: e.target.value } : x,
                    ),
                  }))
                }
                className={`${SLIDER_INPUT} min-w-0 flex-1`}
              />
              {!readOnly ? (
                <button
                  type="button"
                  className="rounded-xl p-2 text-[var(--enterprise-text-muted)] transition hover:bg-amber-50/80 hover:text-red-600"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      delays: (d.delays ?? []).filter((x) => x.id !== it.id),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                </button>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 pl-6 sm:flex-row sm:flex-wrap sm:items-center">
              <input
                disabled={readOnly}
                placeholder="Link issue id (optional)"
                value={it.issueId ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    delays: (d.delays ?? []).map((x) =>
                      x.id === it.id ? { ...x, issueId: e.target.value.trim() || null } : x,
                    ),
                  }))
                }
                className={`${SLIDER_INPUT} min-w-0 flex-1 sm:max-w-xs`}
              />
              {it.issueId ? (
                <Link
                  href={`/projects/${projectId}/issues`}
                  className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[var(--enterprise-semantic-info-border)] bg-[var(--enterprise-semantic-info-bg)] px-3 py-2 text-xs font-semibold text-[var(--enterprise-semantic-info-text)] hover:underline"
                >
                  Issue {it.issueId.slice(0, 6)}…
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {!readOnly ? (
        <div className="flex flex-col gap-2 border-t border-[var(--enterprise-border)]/60 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <button
            type="button"
            className="text-left text-sm font-semibold text-[var(--enterprise-primary)] hover:underline"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                delays: [...(d.delays ?? []), { id: nanoid(), text: "", issueId: null }],
              }))
            }
          >
            + Add delay
          </button>
          <button
            type="button"
            className="text-left text-xs font-semibold text-[var(--enterprise-text-muted)] underline decoration-[var(--enterprise-border)] underline-offset-2 hover:text-[var(--enterprise-text)]"
            onClick={() => toast.message("Open Issues to copy an id, then paste above.")}
          >
            How to link a PlanSync issue
          </button>
        </div>
      ) : null}
    </SliderSectionCard>
  );
}

const MAX_FIELD_REPORT_PHOTOS = 12;

function PhotoSection({
  draft,
  setDraft,
  readOnly,
}: {
  draft: FieldReportDetails;
  setDraft: Dispatch<SetStateAction<FieldReportDetails>>;
  readOnly: boolean;
}) {
  const photos = draft.photos ?? [];
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const addFromFile = async (file: File | null): Promise<boolean> => {
    if (!file || !file.type.startsWith("image/")) return false;
    setBusy(true);
    try {
      const previewBase64 = await compressImageFileToJpegDataUrl(file);
      const caption = file.name?.replace(/\.[^.]+$/, "") || "Photo";
      let added = false;
      setDraft((d) => {
        const cur = d.photos ?? [];
        if (cur.length >= MAX_FIELD_REPORT_PHOTOS) return d;
        added = true;
        return {
          ...d,
          photos: [...cur, { id: nanoid(), caption, previewBase64 }],
        };
      });
      if (!added) toast.error(`Maximum ${MAX_FIELD_REPORT_PHOTOS} photos.`);
      return added;
    } catch {
      toast.error("Could not add photo.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <SliderSectionCard
      kicker="Evidence"
      title="Photos"
      icon={
        <ImageIcon className="h-4 w-4 text-[var(--enterprise-text-muted)]" strokeWidth={1.75} />
      }
    >
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          void addFromFile(f);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const list = e.target.files;
          if (!list?.length) return;
          void (async () => {
            for (const f of Array.from(list)) {
              const ok = await addFromFile(f);
              if (!ok) break;
            }
          })();
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-3">
        {photos.map((p) => (
          <div
            key={p.id}
            className="group relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)] shadow-sm ring-1 ring-inset ring-white/60"
          >
            {p.previewBase64 ? (
              /* eslint-disable-next-line @next/next/no-img-element -- data URL from report */
              <img src={p.previewBase64} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[var(--enterprise-text-muted)]">
                <ImageIcon className="h-8 w-8 opacity-50" strokeWidth={1.75} />
              </div>
            )}
            {!readOnly ? (
              <button
                type="button"
                className="absolute right-1 top-1 rounded-md bg-black/55 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Remove photo"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    photos: (d.photos ?? []).filter((x) => x.id !== p.id),
                  }))
                }
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--enterprise-border)]/60 pt-3">
          <button
            type="button"
            disabled={busy || photos.length >= MAX_FIELD_REPORT_PHOTOS}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--enterprise-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--enterprise-text)] shadow-sm transition hover:border-[var(--enterprise-border)] hover:bg-[var(--enterprise-hover-surface)] disabled:opacity-50"
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="h-4 w-4" strokeWidth={1.75} />
            Take photo
          </button>
          <button
            type="button"
            disabled={busy || photos.length >= MAX_FIELD_REPORT_PHOTOS}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--enterprise-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--enterprise-text)] shadow-sm transition hover:border-[var(--enterprise-border)] hover:bg-[var(--enterprise-hover-surface)] disabled:opacity-50"
            onClick={() => galleryRef.current?.click()}
          >
            <ImageIcon className="h-4 w-4" strokeWidth={1.75} />
            From gallery
          </button>
          <button
            type="button"
            disabled={busy || photos.length >= MAX_FIELD_REPORT_PHOTOS}
            className="min-h-11 text-sm font-semibold text-[var(--enterprise-primary)] hover:underline disabled:opacity-50"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                photos: [...(d.photos ?? []), { id: nanoid(), caption: "" }],
              }))
            }
          >
            + Empty slot
          </button>
        </div>
      ) : null}
    </SliderSectionCard>
  );
}
