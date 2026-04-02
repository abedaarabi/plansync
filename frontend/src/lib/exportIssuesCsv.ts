import type { IssueRow } from "@/lib/api-client";
import { ISSUE_PRIORITY_LABEL, ISSUE_STATUS_LABEL } from "@/lib/issueStatusStyle";

function escCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatUser(u: IssueRow["assignee"]): string {
  if (!u) return "";
  return (u.name || u.email || "").trim();
}

/** RFC 3339-ish display for CSV */
function isoDate(s: string | null | undefined): string {
  if (!s) return "";
  try {
    return new Date(s).toISOString();
  } catch {
    return s;
  }
}

export function buildIssuesCsv(issues: IssueRow[], fileLabel: string): string {
  const lines: string[] = [];
  lines.push(`# Sheet issues — ${fileLabel}`);
  lines.push(
    [
      "Id",
      "Title",
      "Status",
      "Priority",
      "Description",
      "Location",
      "Page",
      "Sheet",
      "Version",
      "Assignee",
      "Due",
      "Start",
      "Created",
      "Updated",
      "PinLinked",
    ]
      .map(escCell)
      .join(","),
  );

  for (const issue of issues) {
    const pri = issue.priority ?? "MEDIUM";
    const status = ISSUE_STATUS_LABEL[issue.status] ?? issue.status;
    const priority = ISSUE_PRIORITY_LABEL[pri] ?? pri;
    lines.push(
      [
        issue.id,
        issue.title,
        status,
        priority,
        (issue.description ?? "").replace(/\n/g, " "),
        issue.location ?? "",
        issue.pageNumber != null ? String(issue.pageNumber) : "",
        issue.sheetName ?? issue.file.name,
        issue.sheetVersion != null ? String(issue.sheetVersion) : String(issue.fileVersion.version),
        formatUser(issue.assignee),
        isoDate(issue.dueDate),
        isoDate(issue.startDate),
        isoDate(issue.createdAt),
        isoDate(issue.updatedAt),
        issue.annotationId ? "yes" : "no",
      ]
        .map(escCell)
        .join(","),
    );
  }

  return lines.join("\r\n");
}

export function downloadIssuesCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
