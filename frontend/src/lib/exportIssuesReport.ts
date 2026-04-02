import type { IssueRow } from "@/lib/api-client";
import { ISSUE_PRIORITY_LABEL, ISSUE_STATUS_LABEL } from "@/lib/issueStatusStyle";

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatUser(u: IssueRow["assignee"]): string {
  if (!u) return "—";
  const t = (u.name || u.email || "").trim();
  return t || "—";
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

/** Opens print dialog; user can choose “Save as PDF”. */
export function openIssuesPrintReport(issues: IssueRow[], fileLabel: string): void {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;

  const rows = issues.map((issue) => {
    const pri = issue.priority ?? "MEDIUM";
    const status = ISSUE_STATUS_LABEL[issue.status] ?? issue.status;
    const priority = ISSUE_PRIORITY_LABEL[pri] ?? pri;
    const page = issue.pageNumber != null ? `p.${issue.pageNumber}` : "—";
    const sheet = issue.sheetName ?? issue.file.name;
    return `<tr>
      <td>${escHtml(issue.title)}</td>
      <td>${escHtml(status)}</td>
      <td>${escHtml(priority)}</td>
      <td>${escHtml(page)}</td>
      <td>${escHtml(sheet)}</td>
      <td>${escHtml(issue.location ?? "—")}</td>
      <td>${escHtml(formatUser(issue.assignee))}</td>
      <td>${escHtml(formatWhen(issue.dueDate))}</td>
      <td>${escHtml(formatWhen(issue.updatedAt))}</td>
      <td>${issue.annotationId ? "Yes" : "—"}</td>
    </tr>`;
  });

  w.document
    .write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${escHtml(fileLabel)} — Issues</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 8px; }
  p { color: #444; font-size: 13px; margin: 0 0 20px; }
  table { border-collapse: collapse; width: 100%; font-size: 11px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; font-weight: 600; }
</style></head><body>
<h1>Sheet issues</h1>
<p>${escHtml(fileLabel)} · ${issues.length} issue${issues.length === 1 ? "" : "s"}</p>
<table>
  <thead><tr>
    <th>Title</th><th>Status</th><th>Priority</th><th>Page</th><th>Sheet</th>
    <th>Location</th><th>Assignee</th><th>Due</th><th>Updated</th><th>Pin</th>
  </tr></thead>
  <tbody>${rows.join("")}</tbody>
</table>
</body></html>`);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 150);
}
