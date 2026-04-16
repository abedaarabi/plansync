import type { ActivityType } from "@prisma/client";

export type AuditPresentation = {
  /** Short label for badges, e.g. "Opened", "Uploaded" */
  actionLabel: string;
  /** Primary line: resource + key fact */
  summary: string;
  /** Full human-readable description for exports / tooltips */
  detail: string;
};

function metaRecord(m: unknown): Record<string, unknown> {
  if (m != null && typeof m === "object" && !Array.isArray(m)) {
    return m as Record<string, unknown>;
  }
  return {};
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && !Number.isNaN(v) ? v : undefined;
}

/**
 * Human-readable labels and copy for activity rows (UI + Excel/PDF).
 */
export function formatAuditPresentation(
  type: ActivityType | string,
  metadata: unknown,
): AuditPresentation {
  const m = metaRecord(metadata);
  const name = str(m.name) ?? str(m.fileName) ?? str(m.folderName);
  const fileName = str(m.fileName);
  const version = num(m.version);
  const fileId = str(m.fileId);
  const fromFolderId = m.fromFolderId;
  const toFolderId = m.toFolderId;
  const fromParentId = m.fromParentId;
  const toParentId = m.toParentId;

  switch (type) {
    case "FILE_OPENED": {
      const v = version != null ? `v${version}` : "";
      const sum = fileName ? `${fileName}${v ? ` · ${v}` : ""}` : "File opened in viewer";
      return {
        actionLabel: "Opened",
        summary: sum,
        detail: [
          fileName && `File: ${fileName}`,
          version != null && `Revision: ${version}`,
          str(m.fileVersionId) && `File version id: ${String(m.fileVersionId)}`,
          fileId && `File id: ${fileId}`,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    }
    case "FILE_VERSION_ADDED":
      return {
        actionLabel: "Upload",
        summary: fileName
          ? `${fileName}${version != null ? ` · v${version}` : ""}`
          : "New file revision",
        detail: [
          fileName && `File: ${fileName}`,
          version != null && `Version: ${version}`,
          fileId && `File id: ${fileId}`,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    case "FILE_VERSION_DELETED":
      return {
        actionLabel: "Revision removed",
        summary: fileName
          ? `${fileName}${version != null ? ` · v${version}` : ""}`
          : "File revision removed",
        detail: [
          fileName && `File: ${fileName}`,
          version != null && `Removed revision: ${version}`,
          fileId && `File id: ${fileId}`,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    case "FILE_DELETED":
      return {
        actionLabel: "Deleted",
        summary: name ?? "File deleted",
        detail: name ? `Removed file “${name}”.` : "File removed from project.",
      };
    case "FILE_MOVED":
      return {
        actionLabel: "Moved",
        summary: name ?? "File moved",
        detail: [
          name && `File: ${name}`,
          `From folder id: ${fromFolderId === null || fromFolderId === undefined ? "root" : String(fromFolderId)}`,
          `To folder id: ${toFolderId === null || toFolderId === undefined ? "root" : String(toFolderId)}`,
        ].join(" · "),
      };
    case "FOLDER_CREATED":
      return {
        actionLabel: "Folder created",
        summary: name ?? "New folder",
        detail: name ? `Created folder “${name}”.` : "Folder created.",
      };
    case "FOLDER_DELETED":
      return {
        actionLabel: "Folder deleted",
        summary: name ?? "Folder removed",
        detail: name ? `Deleted folder “${name}”.` : "Folder removed.",
      };
    case "FOLDER_MOVED":
      return {
        actionLabel: "Folder moved",
        summary: name ?? "Folder moved",
        detail: [
          name && `Folder: ${name}`,
          `From parent id: ${fromParentId === null || fromParentId === undefined ? "root" : String(fromParentId)}`,
          `To parent id: ${toParentId === null || toParentId === undefined ? "root" : String(toParentId)}`,
        ].join(" · "),
      };
    case "PROJECT_CREATED":
      return {
        actionLabel: "Project",
        summary: str(m.name) ?? "Project created",
        detail: str(m.name) ? `Project “${String(m.name)}” was created.` : "Project created.",
      };
    case "PROJECT_UPDATED": {
      const fields = m.updatedFields;
      const fieldList =
        Array.isArray(fields) && fields.length > 0
          ? (fields as unknown[]).map(String).join(", ")
          : "details";
      return {
        actionLabel: "Project updated",
        summary: `Settings · ${fieldList}`,
        detail: `Updated project fields: ${fieldList}.`,
      };
    }
    case "ISSUE_CREATED":
      return {
        actionLabel: "Issue",
        summary: str(m.title) ?? "Issue created",
        detail: str(m.title) ? `Created issue “${String(m.title)}”.` : "Issue created.",
      };
    case "ISSUE_UPDATED":
      return {
        actionLabel: "Issue updated",
        summary: str(m.title) ?? "Issue changed",
        detail: str(m.title) ? `Updated issue “${String(m.title)}”.` : "Issue updated.",
      };
    case "ISSUE_DELETED":
      return {
        actionLabel: "Issue deleted",
        summary: str(m.title) ?? "Issue removed",
        detail: str(m.title) ? `Deleted issue “${String(m.title)}”.` : "Issue deleted.",
      };
    case "RFI_CREATED":
      return {
        actionLabel: "RFI",
        summary: str(m.title) ?? "RFI created",
        detail: str(m.title) ? `RFI “${String(m.title)}”.` : "RFI created.",
      };
    case "RFI_UPDATED":
      if (m.reopened === true) {
        return {
          actionLabel: "RFI reopened",
          summary: str(m.title) ?? "RFI reopened",
          detail: str(m.title)
            ? `Reopened RFI “${String(m.title)}”.`
            : "RFI reopened for further review.",
        };
      }
      if (m.clearedRecordedAnswer === true) {
        return {
          actionLabel: "RFI answer removed",
          summary: str(m.title) ?? "Recorded answer removed",
          detail: str(m.title)
            ? `Removed the recorded answer on “${String(m.title)}”.`
            : "Recorded answer removed from the RFI.",
        };
      }
      return {
        actionLabel: "RFI updated",
        summary: str(m.title) ?? "RFI changed",
        detail: str(m.title) ? `Updated RFI “${String(m.title)}”.` : "RFI updated.",
      };
    case "RFI_DELETED":
      return {
        actionLabel: "RFI deleted",
        summary: str(m.title) ?? "RFI removed",
        detail: str(m.title) ? `Deleted RFI “${String(m.title)}”.` : "RFI removed.",
      };
    case "RFI_SENT_FOR_REVIEW":
      return {
        actionLabel: "RFI sent",
        summary: str(m.title) ?? "RFI sent for review",
        detail: str(m.title) ? `Sent RFI “${String(m.title)}” for review.` : "RFI sent for review.",
      };
    case "RFI_RESPONSE_SUBMITTED":
      return {
        actionLabel: "RFI response",
        summary: str(m.title) ?? "Response submitted",
        detail: str(m.title)
          ? `Recorded answer (from discussion) on “${String(m.title)}”.`
          : "RFI marked answered with a thread message.",
      };
    case "RFI_CLOSED":
      return {
        actionLabel: "RFI closed",
        summary: str(m.title) ?? "RFI closed",
        detail: str(m.title) ? `Closed RFI “${String(m.title)}”.` : "RFI closed.",
      };
    case "RFI_ATTACHMENT_ADDED":
      return {
        actionLabel: "RFI attachment",
        summary: str(m.fileName) ?? "Attachment added",
        detail: str(m.fileName)
          ? `Attached “${String(m.fileName)}” to RFI.`
          : "RFI attachment added.",
      };
    case "RFI_ATTACHMENT_REMOVED":
      return {
        actionLabel: "RFI attachment",
        summary: str(m.fileName) ?? "Attachment removed",
        detail: str(m.fileName)
          ? `Removed “${String(m.fileName)}” from RFI.`
          : "RFI attachment removed.",
      };
    case "RFI_MESSAGE_POSTED":
      return {
        actionLabel: "RFI message",
        summary: str(m.title) ?? "Message posted",
        detail: str(m.excerpt)
          ? `“${String(m.excerpt)}”`
          : str(m.title)
            ? `New discussion message on “${String(m.title)}”.`
            : "Discussion message posted on RFI.",
      };
    case "PUNCH_CREATED":
      return {
        actionLabel: "Punch",
        summary: str(m.location)
          ? `${String(m.location)} · ${String(m.trade ?? "")}`
          : "Punch item created",
        detail:
          [
            str(m.location) && `Location: ${String(m.location)}`,
            str(m.trade) && `Trade: ${String(m.trade)}`,
          ]
            .filter(Boolean)
            .join(" · ") || "Punch item created.",
      };
    case "PUNCH_UPDATED":
      return {
        actionLabel: "Punch updated",
        summary: str(m.location)
          ? `${String(m.location)} · ${String(m.trade ?? "")}`
          : "Punch updated",
        detail:
          [
            str(m.location) && `Location: ${String(m.location)}`,
            str(m.trade) && `Trade: ${String(m.trade)}`,
          ]
            .filter(Boolean)
            .join(" · ") || "Punch item updated.",
      };
    case "PUNCH_DELETED":
      return {
        actionLabel: "Punch deleted",
        summary: str(m.location) ? `${String(m.location)}` : "Punch removed",
        detail:
          [
            str(m.location) && `Location: ${String(m.location)}`,
            str(m.trade) && `Trade: ${String(m.trade)}`,
          ]
            .filter(Boolean)
            .join(" · ") || "Punch item removed.",
      };
    case "FIELD_REPORT_CREATED":
      return {
        actionLabel: "Field report",
        summary: str(m.reportDate) ? `Report · ${String(m.reportDate)}` : "Field report created",
        detail: str(m.reportDate)
          ? `Field report for ${String(m.reportDate)}.`
          : "Field report created.",
      };
    case "FIELD_REPORT_UPDATED":
      return {
        actionLabel: "Field report updated",
        summary: str(m.reportDate) ? `Report · ${String(m.reportDate)}` : "Field report updated",
        detail: str(m.reportDate)
          ? `Updated field report (${String(m.reportDate)}).`
          : "Field report updated.",
      };
    case "FIELD_REPORT_DELETED":
      return {
        actionLabel: "Field report deleted",
        summary: str(m.reportDate) ? `Report · ${String(m.reportDate)}` : "Field report removed",
        detail: str(m.reportDate)
          ? `Removed field report (${String(m.reportDate)}).`
          : "Field report removed.",
      };
    case "FIELD_REPORT_EMAILED":
      return {
        actionLabel: "Field report emailed",
        summary:
          typeof m.recipientCount === "number"
            ? `Sent to ${String(m.recipientCount)} recipient(s)`
            : "Field report emailed",
        detail:
          str(m.mode) === "weekly" && str(m.weekEndingFriday)
            ? `Weekly summary (week ending ${String(m.weekEndingFriday)}).`
            : str(m.reportDate)
              ? `Daily report (${String(m.reportDate)}).`
              : "Field report sent by email.",
      };
    default:
      return {
        actionLabel: String(type).replace(/_/g, " "),
        summary: name ?? String(type),
        detail:
          metadata != null
            ? typeof metadata === "object"
              ? JSON.stringify(metadata, null, 0)
              : String(metadata)
            : "—",
      };
  }
}
