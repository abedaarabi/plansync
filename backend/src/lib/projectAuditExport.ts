import type { ActivityLog, User } from "@prisma/client";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";

import { formatAuditPresentation } from "./auditFormat.js";

export type AuditRow = {
  createdAt: string;
  actionLabel: string;
  summary: string;
  detail: string;
  actorName: string;
  actorEmail: string;
  typeRaw: string;
};

export function auditLogsToRows(
  logs: (ActivityLog & { actor: Pick<User, "id" | "name" | "email"> | null })[],
): AuditRow[] {
  return logs.map((log) => {
    const p = formatAuditPresentation(log.type, log.metadata);
    return {
      createdAt: log.createdAt.toISOString(),
      actionLabel: p.actionLabel,
      summary: p.summary,
      detail: p.detail,
      actorName: log.actor?.name ?? "—",
      actorEmail: log.actor?.email ?? "—",
      typeRaw: log.type,
    };
  });
}

function truncateOneLine(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

export function buildAuditXlsxBuffer(rows: AuditRow[]): Buffer {
  const sheet = XLSX.utils.json_to_sheet(
    rows.map((r) => ({
      "When (UTC)": r.createdAt,
      Action: r.actionLabel,
      Summary: r.summary,
      "Actor name": r.actorName,
      "Actor email": r.actorEmail,
      Details: r.detail,
      "Type (raw)": r.typeRaw,
    })),
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Audit");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function buildAuditPdfBuffer(rows: AuditRow[], title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 36,
      size: "A4",
      layout: "landscape",
      info: { Title: title },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageInnerW = 842 - 36 * 2;
    const col = {
      when: 128,
      action: 72,
      summary: 168,
      actor: 128,
      detail: pageInnerW - 128 - 72 - 168 - 128,
    };
    const rowH = 13;
    const bottomY = 555;

    const drawColumnHeader = (headerY: number) => {
      let x0 = 36;
      doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#334155");
      doc.text("When (UTC)", x0, headerY, { width: col.when });
      x0 += col.when;
      doc.text("Action", x0, headerY, { width: col.action });
      x0 += col.action;
      doc.text("Summary", x0, headerY, { width: col.summary });
      x0 += col.summary;
      doc.text("Actor", x0, headerY, { width: col.actor });
      x0 += col.actor;
      doc.text("Details", x0, headerY, { width: col.detail });
      doc
        .strokeColor("#cbd5e1")
        .lineWidth(0.5)
        .moveTo(36, headerY + 11)
        .lineTo(36 + pageInnerW, headerY + 11)
        .stroke();
      doc.font("Helvetica").fillColor("#1e293b");
      return headerY + 16;
    };

    doc.fontSize(16).fillColor("#0f172a").font("Helvetica-Bold").text(title, { align: "center" });
    doc.moveDown(0.25);
    doc
      .fontSize(8)
      .fillColor("#64748b")
      .font("Helvetica")
      .text(`Generated ${new Date().toISOString()}`, { align: "center" });
    doc.moveDown(0.6);

    doc.y = drawColumnHeader(doc.y);

    for (const r of rows) {
      if (doc.y + rowH > bottomY) {
        doc.addPage();
        doc.y = drawColumnHeader(36);
      }
      const y = doc.y;
      let x0 = 36;
      doc.fontSize(7);
      doc.text(truncateOneLine(r.createdAt, 42), x0, y, { width: col.when, lineGap: 0 });
      x0 += col.when;
      doc.text(truncateOneLine(r.actionLabel, 18), x0, y, { width: col.action, lineGap: 0 });
      x0 += col.action;
      doc.text(truncateOneLine(r.summary, 48), x0, y, { width: col.summary, lineGap: 0 });
      x0 += col.summary;
      doc.text(truncateOneLine(`${r.actorName} <${r.actorEmail}>`, 40), x0, y, {
        width: col.actor,
        lineGap: 0,
      });
      x0 += col.actor;
      doc.text(truncateOneLine(r.detail, 220), x0, y, { width: col.detail, lineGap: 0 });
      doc.y = y + rowH;
    }

    doc.end();
  });
}
