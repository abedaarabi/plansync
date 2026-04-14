import type { FieldReport } from "@prisma/client";
import type { Env } from "./env.js";
import { buildTransactionalEmailHtml, escapeHtml } from "./transactionalEmailLayout.js";

export function buildFieldReportsPageUrl(env: Env, projectId: string, reportQuery?: string | null) {
  const base = env.PUBLIC_APP_URL.replace(/\/$/, "");
  const q =
    reportQuery && reportQuery.length > 0 ? `?report=${encodeURIComponent(reportQuery)}` : "";
  return `${base}/projects/${encodeURIComponent(projectId)}/reports${q}`;
}

/** Monday-based week; returns UTC YYYY-MM-DD of that week's Friday (matches frontend fieldReportUtils). */
export function workWeekFridayKey(reportDateIso: string): string {
  const d = new Date(reportDateIso);
  if (Number.isNaN(d.getTime())) return reportDateIso.slice(0, 10);
  const dow = d.getUTCDay();
  const monOffset = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + monOffset));
  const fri = new Date(Date.UTC(mon.getUTCFullYear(), mon.getUTCMonth(), mon.getUTCDate() + 4));
  return fri.toISOString().slice(0, 10);
}

export type FieldReportEmailInclude = {
  weather: boolean;
  workers: boolean;
  completed: boolean;
  delays: boolean;
  photos: boolean;
  materials: boolean;
};

type LineItem = { text: string };
type Crew = { name: string; workers: number };
type Delay = { text: string };
type Material = { text: string };
type Photo = { caption?: string };

function asObj(x: unknown): Record<string, unknown> | null {
  return x && typeof x === "object" ? (x as Record<string, unknown>) : null;
}

function parseDetails(details: unknown): {
  crews: Crew[];
  workCompleted: LineItem[];
  workInProgress: LineItem[];
  delays: Delay[];
  materials: Material[];
  photos: Photo[];
  morningCond: string;
  afternoonCond: string;
  workConditions: string;
} {
  const o = asObj(details) ?? {};
  const weather = asObj(o.weather) ?? {};
  const morning = asObj(weather.morning) ?? {};
  const afternoon = asObj(weather.afternoon) ?? {};
  const lines = (key: string): LineItem[] => {
    const a = o[key];
    if (!Array.isArray(a)) return [];
    return a
      .filter((i) => i && typeof i === "object")
      .map((i) => ({ text: String((i as Record<string, unknown>).text ?? "").trim() }))
      .filter((i) => i.text.length > 0);
  };
  const crewsRaw = o.crews;
  const crews: Crew[] = Array.isArray(crewsRaw)
    ? crewsRaw
        .filter((c) => c && typeof c === "object")
        .map((c) => {
          const r = c as Record<string, unknown>;
          return {
            name: String(r.name ?? "").trim(),
            workers: typeof r.workers === "number" ? r.workers : Number(r.workers) || 0,
          };
        })
        .filter((c) => c.name.length > 0)
    : [];
  const delaysRaw = o.delays;
  const delays: Delay[] = Array.isArray(delaysRaw)
    ? delaysRaw
        .filter((d) => d && typeof d === "object")
        .map((d) => ({ text: String((d as Record<string, unknown>).text ?? "").trim() }))
        .filter((d) => d.text.length > 0)
    : [];
  const matRaw = o.materials;
  const materials: Material[] = Array.isArray(matRaw)
    ? matRaw
        .filter((m) => m && typeof m === "object")
        .map((m) => ({ text: String((m as Record<string, unknown>).text ?? "").trim() }))
        .filter((m) => m.text.length > 0)
    : [];
  const phRaw = o.photos;
  const photos: Photo[] = Array.isArray(phRaw)
    ? phRaw
        .filter((p) => p && typeof p === "object")
        .map((p) => {
          const r = p as Record<string, unknown>;
          const cap = r.caption;
          return { caption: typeof cap === "string" ? cap.trim() : undefined };
        })
    : [];
  return {
    crews,
    workCompleted: lines("workCompleted"),
    workInProgress: lines("workInProgress"),
    delays,
    materials,
    photos,
    morningCond: String(morning.condition ?? "").trim(),
    afternoonCond: String(afternoon.condition ?? "").trim(),
    workConditions: String(weather.workConditions ?? "").trim(),
  };
}

function weatherSummary(report: FieldReport, d: ReturnType<typeof parseDetails>): string {
  const leg = report.weather?.trim() ?? "";
  const m = d.morningCond;
  const a = d.afternoonCond;
  let line = "";
  if (m && a) line = `${m} / ${a}`;
  else if (m) line = m;
  else if (a) line = a;
  else line = leg;
  const wc = d.workConditions;
  if (wc) line = line ? `${line} · ${wc}` : wc;
  return line || "—";
}

function formatYmd(iso: string): string {
  const day = iso.slice(0, 10);
  const t = new Date(`${day}T12:00:00.000Z`);
  if (Number.isNaN(t.getTime())) return day;
  return t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function sectionHtml(title: string, inner: string): string {
  return `<div style="margin:20px 0 0">
  <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em">${escapeHtml(title)}</p>
  ${inner}
</div>`;
}

function buildDailyBlocksHtml(report: FieldReport, include: FieldReportEmailInclude): string {
  const d = parseDetails(report.details);
  const parts: string[] = [];
  if (include.weather) {
    const w = weatherSummary(report, d);
    parts.push(
      sectionHtml(
        "Weather",
        `<p style="margin:0;font-size:14px;line-height:1.6;color:#334155">${escapeHtml(w)}</p>`,
      ),
    );
  }
  if (include.workers) {
    const lines: string[] = [];
    lines.push(`Total on site: ${report.totalWorkers ?? 0}`);
    if (d.crews.length) {
      for (const c of d.crews) {
        lines.push(`${c.name}: ${c.workers}`);
      }
    }
    parts.push(
      sectionHtml(
        "Workers",
        `<ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.55;color:#334155">${lines
          .map((l) => `<li style="margin:4px 0">${escapeHtml(l)}</li>`)
          .join("")}</ul>`,
      ),
    );
  }
  if (include.completed) {
    const items: string[] = [];
    for (const x of d.workCompleted) items.push(x.text);
    for (const x of d.workInProgress) items.push(`(In progress) ${x.text}`);
    const inner =
      items.length === 0
        ? `<p style="margin:0;font-size:14px;color:#64748b">No items recorded.</p>`
        : `<ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.55;color:#334155">${items
            .map((l) => `<li style="margin:4px 0">${escapeHtml(l)}</li>`)
            .join("")}</ul>`;
    parts.push(sectionHtml("Work completed", inner));
  }
  if (include.delays) {
    const items = d.delays.map((x) => x.text);
    const inner =
      items.length === 0
        ? `<p style="margin:0;font-size:14px;color:#64748b">None recorded.</p>`
        : `<ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.55;color:#334155">${items
            .map((l) => `<li style="margin:4px 0">${escapeHtml(l)}</li>`)
            .join("")}</ul>`;
    parts.push(sectionHtml("Delays and issues", inner));
  }
  if (include.materials) {
    const items = d.materials.map((x) => x.text);
    const inner =
      items.length === 0
        ? `<p style="margin:0;font-size:14px;color:#64748b">None recorded.</p>`
        : `<ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.55;color:#334155">${items
            .map((l) => `<li style="margin:4px 0">${escapeHtml(l)}</li>`)
            .join("")}</ul>`;
    parts.push(sectionHtml("Materials", inner));
  }
  if (include.photos) {
    const n = report.photoCount ?? d.photos.length;
    const caps = d.photos.map((p) => p.caption).filter((c): c is string => !!c && c.length > 0);
    const capBlock =
      caps.length > 0
        ? `<p style="margin:8px 0 0;font-size:13px;color:#475569">${escapeHtml(caps.join(" · "))}</p>`
        : "";
    parts.push(
      sectionHtml(
        "Photos",
        `<p style="margin:0;font-size:14px;line-height:1.6;color:#334155">${escapeHtml(String(n))} photo(s) on file in PlanSync.</p>${capBlock}`,
      ),
    );
  }
  const notes = report.notes?.trim();
  if (notes) {
    parts.push(
      sectionHtml(
        "Notes",
        `<p style="margin:0;font-size:14px;line-height:1.65;color:#334155">${escapeHtml(notes)}</p>`,
      ),
    );
  }
  return parts.join("");
}

function buildWeeklyBlocksHtml(reports: FieldReport[], include: FieldReportEmailInclude): string {
  const sorted = [...reports].sort((a, b) =>
    a.reportDate.toISOString().localeCompare(b.reportDate.toISOString()),
  );
  return sorted
    .map((r) => {
      const day = formatYmd(r.reportDate.toISOString());
      const inner = buildDailyBlocksHtml(r, include);
      return `<div style="margin:24px 0 0;padding-top:20px;border-top:1px solid #e2e8f0">
  <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#0f172a">${escapeHtml(day)}${r.authorLabel?.trim() ? ` · ${escapeHtml(r.authorLabel.trim())}` : ""}</p>
  ${inner}
</div>`;
    })
    .join("");
}

export function buildFieldReportEmailSubject(input: {
  projectName: string;
  mode: "daily" | "weekly";
  reportDateYmd?: string;
  weekEndingYmd?: string;
}): string {
  const p = input.projectName.trim() || "Project";
  if (input.mode === "weekly" && input.weekEndingYmd) {
    return `PlanSync: Weekly field reports — ${p} (week ending ${input.weekEndingYmd})`;
  }
  const d = input.reportDateYmd ?? "—";
  return `PlanSync: Field report — ${p} — ${d}`;
}

export function buildFieldReportEmailHtml(
  env: Env,
  input: {
    senderName: string;
    projectName: string;
    mode: "daily" | "weekly";
    headline: string;
    message?: string;
    reportsUrl: string;
    reports: FieldReport[];
    include: FieldReportEmailInclude;
  },
): string {
  const msg = input.message?.trim();
  const bodyLines = [
    `${input.senderName} shared a field report for ${input.projectName}.`,
    msg ? `Message: ${msg}` : "",
  ].filter((l) => l.length > 0);
  const extra =
    input.mode === "daily" && input.reports[0]
      ? buildDailyBlocksHtml(input.reports[0], input.include)
      : buildWeeklyBlocksHtml(input.reports, input.include);
  return buildTransactionalEmailHtml(env, {
    eyebrow: "Field reports",
    title: input.headline,
    bodyLines,
    extraHtml: extra,
    primaryAction: { url: input.reportsUrl, label: "Open field reports" },
    fallbackUrl: input.reportsUrl,
  });
}

export function buildFieldReportEmailText(input: {
  senderName: string;
  projectName: string;
  mode: "daily" | "weekly";
  headline: string;
  message?: string;
  reportsUrl: string;
  reports: FieldReport[];
  include: FieldReportEmailInclude;
}): string {
  const msg = input.message?.trim();
  const lines: string[] = [
    `${input.senderName} shared a field report for ${input.projectName}.`,
    "",
    input.headline,
    "",
  ];
  if (msg) {
    lines.push(`Message: ${msg}`, "");
  }
  const pushSection = (title: string, body: string[]) => {
    lines.push(title, ...body.map((b) => `  ${b}`), "");
  };
  for (const report of [...input.reports].sort((a, b) =>
    a.reportDate.toISOString().localeCompare(b.reportDate.toISOString()),
  )) {
    if (input.mode === "weekly") {
      lines.push(
        `— ${formatYmd(report.reportDate.toISOString())}${report.authorLabel?.trim() ? ` · ${report.authorLabel.trim()}` : ""}`,
        "",
      );
    }
    const d = parseDetails(report.details);
    if (input.include.weather) {
      pushSection("Weather", [weatherSummary(report, d)]);
    }
    if (input.include.workers) {
      const wlines = [`Total on site: ${report.totalWorkers ?? 0}`];
      for (const c of d.crews) wlines.push(`${c.name}: ${c.workers}`);
      pushSection("Workers", wlines);
    }
    if (input.include.completed) {
      const items = [
        ...d.workCompleted.map((x) => x.text),
        ...d.workInProgress.map((x) => `(In progress) ${x.text}`),
      ];
      pushSection("Work completed", items.length ? items : ["No items recorded."]);
    }
    if (input.include.delays) {
      pushSection(
        "Delays and issues",
        d.delays.length ? d.delays.map((x) => x.text) : ["None recorded."],
      );
    }
    if (input.include.materials) {
      pushSection(
        "Materials",
        d.materials.length ? d.materials.map((x) => x.text) : ["None recorded."],
      );
    }
    if (input.include.photos) {
      const n = report.photoCount ?? d.photos.length;
      const caps = d.photos.map((p) => p.caption).filter(Boolean) as string[];
      pushSection("Photos", [
        `${n} photo(s) on file in PlanSync.`,
        ...(caps.length ? [caps.join(" · ")] : []),
      ]);
    }
    const notes = report.notes?.trim();
    if (notes) pushSection("Notes", [notes]);
  }
  lines.push(`Open in PlanSync:`, input.reportsUrl);
  return lines.join("\n");
}
