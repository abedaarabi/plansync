import type { FieldReportRow } from "@/lib/api-client";

export type ReportKind = "DAILY" | "WEEKLY";
export type ReportStatus = "DRAFT" | "SUBMITTED";

export type FieldReportCrew = { id: string; name: string; workers: number };
export type FieldReportLineItem = { id: string; text: string; percent?: number };
export type FieldReportDelay = { id: string; text: string; issueId?: string | null };
export type FieldReportMaterial = { id: string; text: string };
export type FieldReportVisitor = { id: string; text: string };
export type FieldReportPhoto = { id: string; caption?: string; previewBase64?: string | null };

export type FieldReportDetails = {
  weather?: {
    morning?: { condition?: string; tempC?: number | null };
    afternoon?: { condition?: string; tempC?: number | null };
    workConditions?: string;
  };
  crews?: FieldReportCrew[];
  workCompleted?: FieldReportLineItem[];
  workInProgress?: FieldReportLineItem[];
  delays?: FieldReportDelay[];
  materials?: FieldReportMaterial[];
  visitors?: FieldReportVisitor[];
  photos?: FieldReportPhoto[];
};

export function normalizeFieldReport(r: FieldReportRow): FieldReportRow {
  return {
    ...r,
    reportKind: r.reportKind ?? "DAILY",
    status: r.status ?? "DRAFT",
    totalWorkers: typeof r.totalWorkers === "number" ? r.totalWorkers : 0,
    details: r.details ?? null,
    lastEmailedAt: r.lastEmailedAt ?? null,
    emailSentCount: typeof r.emailSentCount === "number" ? r.emailSentCount : 0,
  };
}

export function emptyDetails(): FieldReportDetails {
  return {
    weather: {
      morning: { condition: "", tempC: null },
      afternoon: { condition: "", tempC: null },
      workConditions: "",
    },
    crews: [],
    workCompleted: [],
    workInProgress: [],
    delays: [],
    materials: [],
    visitors: [],
    photos: [],
  };
}

export function parseDetails(raw: unknown): FieldReportDetails {
  const base = emptyDetails();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const w =
    o.weather && typeof o.weather === "object" ? (o.weather as Record<string, unknown>) : {};
  const m =
    w.morning && typeof w.morning === "object" ? (w.morning as Record<string, unknown>) : {};
  const a =
    w.afternoon && typeof w.afternoon === "object" ? (w.afternoon as Record<string, unknown>) : {};
  const asLine = (x: unknown): FieldReportLineItem[] =>
    Array.isArray(x)
      ? x
          .filter((i) => i && typeof i === "object")
          .map((i) => {
            const it = i as Record<string, unknown>;
            return {
              id: String(it.id ?? ""),
              text: String(it.text ?? ""),
              percent: typeof it.percent === "number" ? it.percent : undefined,
            };
          })
          .filter((i) => i.id)
      : [];
  const asCrew = (x: unknown): FieldReportCrew[] =>
    Array.isArray(x)
      ? x
          .filter((i) => i && typeof i === "object")
          .map((i) => {
            const it = i as Record<string, unknown>;
            return {
              id: String(it.id ?? ""),
              name: String(it.name ?? ""),
              workers: typeof it.workers === "number" ? it.workers : Number(it.workers) || 0,
            };
          })
          .filter((i) => i.id)
      : [];
  const asDelay = (x: unknown): FieldReportDelay[] =>
    Array.isArray(x)
      ? x
          .filter((i) => i && typeof i === "object")
          .map((i) => {
            const it = i as Record<string, unknown>;
            return {
              id: String(it.id ?? ""),
              text: String(it.text ?? ""),
              issueId: typeof it.issueId === "string" ? it.issueId : null,
            };
          })
          .filter((i) => i.id)
      : [];
  const asMat = (x: unknown): FieldReportMaterial[] =>
    Array.isArray(x)
      ? x
          .filter((i) => i && typeof i === "object")
          .map((i) => {
            const it = i as Record<string, unknown>;
            return { id: String(it.id ?? ""), text: String(it.text ?? "") };
          })
          .filter((i) => i.id)
      : [];
  const asVis = (x: unknown): FieldReportVisitor[] =>
    Array.isArray(x)
      ? x
          .filter((i) => i && typeof i === "object")
          .map((i) => {
            const it = i as Record<string, unknown>;
            return { id: String(it.id ?? ""), text: String(it.text ?? "") };
          })
          .filter((i) => i.id)
      : [];
  const asPh = (x: unknown): FieldReportPhoto[] =>
    Array.isArray(x)
      ? x
          .filter((i) => i && typeof i === "object")
          .map((i) => {
            const it = i as Record<string, unknown>;
            return {
              id: String(it.id ?? ""),
              caption: typeof it.caption === "string" ? it.caption : undefined,
              previewBase64: typeof it.previewBase64 === "string" ? it.previewBase64 : undefined,
            };
          })
          .filter((i) => i.id)
      : [];
  return {
    weather: {
      morning: {
        condition: typeof m.condition === "string" ? m.condition : base.weather?.morning?.condition,
        tempC: typeof m.tempC === "number" ? m.tempC : null,
      },
      afternoon: {
        condition:
          typeof a.condition === "string" ? a.condition : base.weather?.afternoon?.condition,
        tempC: typeof a.tempC === "number" ? a.tempC : null,
      },
      workConditions:
        typeof w.workConditions === "string" ? w.workConditions : base.weather?.workConditions,
    },
    crews: asCrew(o.crews).length ? asCrew(o.crews) : base.crews,
    workCompleted: asLine(o.workCompleted).length ? asLine(o.workCompleted) : base.workCompleted,
    workInProgress: asLine(o.workInProgress).length
      ? asLine(o.workInProgress)
      : base.workInProgress,
    delays: asDelay(o.delays).length ? asDelay(o.delays) : base.delays,
    materials: asMat(o.materials).length ? asMat(o.materials) : base.materials,
    visitors: asVis(o.visitors).length ? asVis(o.visitors) : base.visitors,
    photos: asPh(o.photos).length ? asPh(o.photos) : base.photos,
  };
}

export function sumCrewWorkers(d: FieldReportDetails): number {
  return (d.crews ?? []).reduce((a, c) => a + Math.max(0, Number(c.workers) || 0), 0);
}

export function primaryWeatherLabel(
  weatherCol: string | null | undefined,
  d: FieldReportDetails,
): string {
  const m = d.weather?.morning?.condition?.trim();
  const a = d.weather?.afternoon?.condition?.trim();
  if (m && a) return `${m} / ${a}`;
  if (m) return m;
  if (a) return a;
  const leg = weatherCol?.trim();
  return leg || "—";
}

/** Monday-based week; returns UTC YYYY-MM-DD of that week's Friday. */
export function workWeekFridayKey(reportDateIso: string): string {
  const d = new Date(reportDateIso);
  if (Number.isNaN(d.getTime())) return reportDateIso.slice(0, 10);
  const dow = d.getUTCDay();
  const monOffset = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + monOffset));
  const fri = new Date(Date.UTC(mon.getUTCFullYear(), mon.getUTCMonth(), mon.getUTCDate() + 4));
  return fri.toISOString().slice(0, 10);
}

export function isoWeekNumberUtc(isoYmd: string): number {
  const target = new Date(isoYmd + "T12:00:00.000Z");
  if (Number.isNaN(target.getTime())) return 1;
  const dayNr = (target.getUTCDay() + 6) % 7;
  const thursday = new Date(target);
  thursday.setUTCDate(target.getUTCDate() - dayNr + 3);
  const jan4 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const diffDays =
    (thursday.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7);
  return 1 + Math.round(diffDays / 7);
}

export type WeeklyVirtual = {
  id: string;
  weekEndingFriday: string;
  weekLabel: string;
  days: FieldReportRow[];
};

export function buildWeeklyVirtuals(reports: FieldReportRow[]): WeeklyVirtual[] {
  const dailies = reports.filter((r) => (r.reportKind ?? "DAILY") === "DAILY");
  const byWeek = new Map<string, FieldReportRow[]>();
  for (const r of dailies) {
    const key = workWeekFridayKey(r.reportDate);
    const list = byWeek.get(key) ?? [];
    list.push(r);
    byWeek.set(key, list);
  }
  const out: WeeklyVirtual[] = [];
  for (const [weekEndingFriday, days] of byWeek) {
    if (days.length === 0) continue;
    const sorted = [...days].sort((a, b) => a.reportDate.localeCompare(b.reportDate));
    out.push({
      id: `virtual-week-${weekEndingFriday}`,
      weekEndingFriday,
      weekLabel: `W${isoWeekNumberUtc(weekEndingFriday)}`,
      days: sorted,
    });
  }
  return out.sort((a, b) => b.weekEndingFriday.localeCompare(a.weekEndingFriday));
}

export function dailyDisplayNumbers(reports: FieldReportRow[]): Map<string, string> {
  const dailies = reports
    .filter((r) => (r.reportKind ?? "DAILY") === "DAILY")
    .sort((a, b) => {
      const da = a.reportDate.localeCompare(b.reportDate);
      if (da !== 0) return da;
      return a.createdAt.localeCompare(b.createdAt);
    });
  const m = new Map<string, string>();
  const n = dailies.length;
  dailies.forEach((r, i) => {
    m.set(r.id, String(n - i).padStart(3, "0"));
  });
  return m;
}

export function formatReportTableDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatWeekEndingLabel(ymd: string): string {
  const d = new Date(ymd + "T12:00:00.000Z");
  if (Number.isNaN(d.getTime())) return ymd;
  return `W/E ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

const MAX_JPEG_DATA_URL_CHARS = 480_000;

/** Resize and compress to JPEG data URL for storing on `FieldReportPhoto.previewBase64`. */
export async function compressImageFileToJpegDataUrl(
  file: File,
  maxEdge = 1400,
  initialQuality = 0.82,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not read image.");
    ctx.drawImage(bitmap, 0, 0, w, h);
    let q = initialQuality;
    let out = canvas.toDataURL("image/jpeg", q);
    while (out.length > MAX_JPEG_DATA_URL_CHARS && q > 0.42) {
      q -= 0.06;
      out = canvas.toDataURL("image/jpeg", q);
    }
    return out;
  } finally {
    bitmap.close();
  }
}
