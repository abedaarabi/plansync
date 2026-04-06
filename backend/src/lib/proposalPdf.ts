import PDFDocument from "pdfkit";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { getEmailBrandIconPngBytes } from "./emailBrandIcon.js";

type PdfDoc = InstanceType<typeof PDFDocument>;

marked.use({ gfm: true, breaks: true });

/** Same heuristic as the app preview / client portal (proposalRoutes preview, ProposalLetterPreviewBlock). */
function looksLikeProposalCoverHtml(raw: string): boolean {
  const t = raw.trim();
  return /^\s*</.test(t) && /<[a-z]/i.test(t);
}

/**
 * Turn stored cover (Markdown or sanitized HTML) into plain text with real newlines for PDFKit.
 * Previously we stripped all tags and collapsed whitespace, which broke Markdown and paragraphs.
 */
export function proposalCoverPlainForPdf(raw: string): string {
  const input = raw.trim();
  if (!input) return "";
  const html = looksLikeProposalCoverHtml(input) ? input : (marked.parse(input) as string);
  return htmlCoverToPdfPlain(html);
}

function htmlCoverToPdfPlain(html: string): string {
  let s = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n\n")
    .replace(/<\s*p[^>]*>/gi, "")
    .replace(/<\/\s*h[1-6]\s*>/gi, "\n\n")
    .replace(/<\s*h[1-6][^>]*>/gi, "")
    .replace(/<\/\s*blockquote\s*>/gi, "\n\n")
    .replace(/<\s*blockquote[^>]*>/gi, "")
    .replace(/<\s*hr\s*\/?>/gi, "\n———\n")
    .replace(/<\/\s*ul\s*>/gi, "\n")
    .replace(/<\/\s*ol\s*>/gi, "\n")
    .replace(/<\/\s*li\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<\s*pre[^>]*>/gi, "\n")
    .replace(/<\/\s*pre\s*>/gi, "\n\n")
    .replace(/<\s*code[^>]*>/gi, "")
    .replace(/<\/\s*code\s*>/gi, "")
    .replace(/<\s*table[^>]*>/gi, "\n")
    .replace(/<\/\s*table\s*>/gi, "\n\n")
    .replace(/<\s*\/?\s*(thead|tbody|tfoot|colgroup|col)[^>]*>/gi, "")
    .replace(/<\s*tr[^>]*>/gi, "\n")
    .replace(/<\/\s*tr\s*>/gi, "\n")
    .replace(/<\s*t[hd][^>]*>/gi, "")
    .replace(/<\/\s*t[hd]\s*>/gi, "\t");
  const stripped = sanitizeHtml(s, { allowedTags: [], allowedAttributes: {} });
  const lines = stripped.split("\n").map((l) => l.replace(/[ \t]+/g, " ").trimEnd());
  const collapsed: string[] = [];
  let blankRun = 0;
  for (const line of lines) {
    if (line === "") {
      blankRun++;
      if (blankRun <= 2) collapsed.push("");
    } else {
      blankRun = 0;
      collapsed.push(line);
    }
  }
  return collapsed.join("\n").trim();
}

function truncateLine(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Human-friendly UTC line for signed proposal PDFs (avoids raw ISO). */
export function formatProposalAcceptanceTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    const dateLine = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(d);
    const timeLine = new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: "UTC",
    }).format(d);
    return `${dateLine} · ${timeLine} UTC`;
  } catch {
    return d.toUTCString();
  }
}

const C = {
  accent: "#2563eb",
  accentDark: "#1e40af",
  slate50: "#f8fafc",
  slate200: "#e2e8f0",
  slate400: "#94a3b8",
  slate500: "#64748b",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1e293b",
  slate900: "#0f172a",
  white: "#ffffff",
} as const;

/** PDFKit supports PNG, JPEG, GIF, WebP — not SVG. */
function isLikelyPdfKitRasterBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  const b0 = buf[0]!;
  const b1 = buf[1]!;
  if (b0 === 0x89 && b1 === 0x50) return true;
  if (b0 === 0xff && b1 === 0xd8) return true;
  if (buf.subarray(0, 3).toString("ascii") === "GIF") return true;
  if (
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return true;
  }
  return false;
}

function workspaceInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
  }
  const w = parts[0] ?? "?";
  return w.slice(0, 2).toUpperCase();
}

function drawWorkspaceLogoFallback(
  doc: PdfDoc,
  x: number,
  y: number,
  box: number,
  workspaceName: string,
) {
  const initials = workspaceInitials(workspaceName);
  doc.save();
  doc.fillColor(C.slate50).roundedRect(x, y, box, box, 8).fill();
  doc.strokeColor(C.slate200).lineWidth(0.75).roundedRect(x, y, box, box, 8).stroke();
  doc
    .fillColor(C.accent)
    .font("Helvetica-Bold")
    .fontSize(box * 0.36);
  doc.text(initials, x, y + box * 0.28, { width: box, align: "center" });
  doc.restore();
}

export type ProposalPdfLine = {
  itemName: string;
  quantity: string;
  unit: string;
  rate: string;
  lineTotal: string;
};

export function buildProposalPdfBuffer(input: {
  title: string;
  reference: string;
  workspaceName: string;
  clientName: string;
  /** Shown in the summary card when set */
  clientCompany?: string;
  /** Shown in the summary card when set */
  projectName?: string;
  validUntilLabel: string;
  coverHtml: string;
  lines: ProposalPdfLine[];
  subtotal: string;
  /** e.g. "Work (15%)" — drawn between subtotal and tax when set */
  workFeeLabel?: string;
  workFeeAmount?: string;
  taxLabel: string;
  taxAmount: string;
  discount: string;
  total: string;
  signedAtIso?: string;
  signerName?: string;
  signaturePngBuffer?: Buffer | null;
  /** PNG/JPEG/WebP/GIF bytes — embedded top-right when valid */
  logoImageBuffer?: Buffer | null;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const sideMargin = 48;
    const footerBand = 20;
    const doc = new PDFDocument({
      margins: {
        top: sideMargin,
        left: sideMargin,
        right: sideMargin,
        bottom: sideMargin + footerBand,
      },
      size: "A4",
      layout: "portrait",
      info: { Title: input.title, Author: input.workspaceName },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;
    const margin = sideMargin;
    const innerW = pageW - doc.page.margins.left - doc.page.margins.right;
    const tablePad = 10;
    const colItem = Math.min(220, Math.floor(innerW * 0.38));
    const colQty = 44;
    const colUnit = 40;
    const colRate = 72;
    const colTot = innerW - colItem - colQty - colUnit - colRate;
    /** Must match PDFKit’s LineWrapper limit so we don’t add a manual page while text could still fit. */
    const contentBottomY = () => doc.page.maxY();

    const drawTopAccent = () => {
      doc.save();
      doc.rect(0, 0, pageW, 7).fill(C.accent);
      doc.restore();
    };

    const planSyncHeaderPng = getEmailBrandIconPngBytes();
    const planSyncHeaderSize = 34;
    doc.font("Helvetica-Bold").fontSize(8);
    const planSyncWordW = doc.widthOfString("Plan") + doc.widthOfString("Sync");
    /** Column wide enough for icon and centered wordmark. */
    const planSyncHeaderColW = Math.max(planSyncHeaderSize, planSyncWordW + 4);

    /** PlanSync mark + “Plan” / “Sync” (blue) — top-right of the content area (every page). */
    const drawPlanSyncTopRight = (topY: number) => {
      const colRight = margin + innerW;
      const colLeft = colRight - planSyncHeaderColW;
      const wPlan = doc.widthOfString("Plan");
      const wSync = doc.widthOfString("Sync");
      const wordW = wPlan + wSync;
      const wordX = colLeft + (planSyncHeaderColW - wordW) / 2;

      let wordmarkY = topY;
      if (planSyncHeaderPng?.length && isLikelyPdfKitRasterBuffer(planSyncHeaderPng)) {
        try {
          const imgX = colLeft + (planSyncHeaderColW - planSyncHeaderSize) / 2;
          doc.image(planSyncHeaderPng, imgX, topY, {
            width: planSyncHeaderSize,
            height: planSyncHeaderSize,
            fit: [planSyncHeaderSize, planSyncHeaderSize],
          });
          wordmarkY = topY + planSyncHeaderSize + 4;
        } catch {
          /* fall through: wordmark only */
        }
      }

      doc.font("Helvetica-Bold").fontSize(8);
      doc.fillColor(C.slate900).text("Plan", wordX, wordmarkY, { lineBreak: false });
      doc.fillColor(C.accent).text("Sync", wordX + wPlan, wordmarkY, { lineBreak: false });
    };

    const drawTableHeader = (yTop: number): number => {
      const h = 24;
      doc.save();
      doc.fillColor(C.accentDark).roundedRect(margin, yTop, innerW, h, 4).fill();
      doc.restore();
      doc.fillColor(C.white).font("Helvetica-Bold").fontSize(8.5);
      const ty = yTop + 8;
      doc.text("Item", margin + tablePad, ty, { width: colItem - tablePad });
      doc.text("Qty", margin + colItem, ty, { width: colQty, align: "right" });
      doc.text("Unit", margin + colItem + colQty, ty, { width: colUnit });
      doc.text("Rate", margin + colItem + colQty + colUnit, ty, { width: colRate, align: "right" });
      doc.text("Total", margin + colItem + colQty + colUnit + colRate, ty, {
        width: colTot,
        align: "right",
      });
      return yTop + h;
    };

    drawTopAccent();

    let y = margin + 6;
    drawPlanSyncTopRight(y);

    const logoBox = 58;
    const afterLogoGap = 12;
    const headerTextX = margin + logoBox + afterLogoGap;
    const headerRightReserve = planSyncHeaderColW + 12;
    const headerTextW = innerW - logoBox - afterLogoGap - headerRightReserve;

    let workspaceLogoOk = false;
    if (input.logoImageBuffer?.length && isLikelyPdfKitRasterBuffer(input.logoImageBuffer)) {
      try {
        doc.image(input.logoImageBuffer, margin, y, {
          fit: [logoBox, logoBox],
          width: logoBox,
          height: logoBox,
        });
        workspaceLogoOk = true;
      } catch {
        workspaceLogoOk = false;
      }
    }
    if (!workspaceLogoOk) {
      drawWorkspaceLogoFallback(doc, margin, y, logoBox, input.workspaceName);
    }

    doc.fontSize(8).fillColor(C.accent).font("Helvetica-Bold").text("PROPOSAL", headerTextX, y, {
      characterSpacing: 1.2,
    });
    doc
      .fontSize(20)
      .fillColor(C.slate900)
      .text(input.title, headerTextX, y + 12, {
        width: headerTextW,
        lineGap: 2,
      });
    y = Math.max(doc.y, y + logoBox) + 14;

    const clientLine = input.clientCompany
      ? `${input.clientName} · ${input.clientCompany}`
      : input.clientName;

    const metaH = input.projectName ? 108 : 96;
    doc.save();
    doc.fillColor(C.slate50).roundedRect(margin, y, innerW, metaH, 8).fill();
    doc.strokeColor(C.slate200).lineWidth(0.75).roundedRect(margin, y, innerW, metaH, 8).stroke();
    doc.restore();

    const half = (innerW - 20) / 2;
    const gx = margin + 10;
    const gy = y + 12;

    const label = (lx: number, ly: number, t: string) => {
      doc.fontSize(7.5).fillColor(C.slate500).font("Helvetica-Bold").text(t, lx, ly);
    };
    const value = (lx: number, ly: number, t: string, w: number) => {
      doc.fontSize(10).fillColor(C.slate800).font("Helvetica").text(t, lx, ly, { width: w });
    };

    label(gx, gy, "FROM");
    value(gx, gy + 10, input.workspaceName, half - 4);
    label(gx + half, gy, "REFERENCE");
    value(gx + half, gy + 10, input.reference, half - 4);

    const gy2 = gy + 38;
    if (input.projectName) {
      label(gx, gy2, "PROJECT");
      value(gx, gy2 + 10, input.projectName, half - 4);
    }
    label(gx + half, gy2, "VALID UNTIL");
    value(gx + half, gy2 + 10, input.validUntilLabel, half - 4);

    const gy3 = gy2 + 38;
    label(gx, gy3, "PREPARED FOR");
    value(gx, gy3 + 10, clientLine, innerW - 20);

    y += metaH + 20;
    doc.x = margin;
    doc.y = y;

    const minSpaceCoverSection = 88;
    if (y > contentBottomY() - minSpaceCoverSection) {
      doc.addPage();
      drawTopAccent();
      y = margin + 12;
      drawPlanSyncTopRight(y);
      doc.x = margin;
      doc.y = y;
    }

    doc.save();
    doc.fillColor(C.accent).rect(margin, y, 3, 14).fill();
    doc.restore();
    doc
      .fontSize(12)
      .fillColor(C.slate900)
      .font("Helvetica-Bold")
      .text("Cover letter", margin + 10, y);
    y += 22;

    const letter = proposalCoverPlainForPdf(input.coverHtml);
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor(C.slate700)
      .text(letter || "—", margin, y, {
        width: innerW,
        align: "left",
        lineGap: 3,
      });
    y = doc.y + 22;

    const minSpacePriceHeader = 110;
    if (y > contentBottomY() - minSpacePriceHeader) {
      doc.addPage();
      drawTopAccent();
      y = margin + 12;
      drawPlanSyncTopRight(y);
      doc.x = margin;
      doc.y = y;
    }

    doc
      .fontSize(12)
      .fillColor(C.slate900)
      .font("Helvetica-Bold")
      .text("Price breakdown", margin, y);
    y += 18;

    const minSpaceForRow = 28;

    y = drawTableHeader(y);
    doc.x = margin;
    doc.y = y;

    const rowH = 22;
    doc.font("Helvetica").fillColor(C.slate800);
    input.lines.forEach((row, i) => {
      if (y > contentBottomY() - minSpaceForRow) {
        doc.addPage();
        drawTopAccent();
        y = margin + 12;
        drawPlanSyncTopRight(y);
        y = drawTableHeader(y);
        doc.x = margin;
        doc.y = y;
      }
      const rowY = y;
      if (i % 2 === 1) {
        doc.save();
        doc.fillColor(C.slate50).rect(margin, rowY, innerW, rowH).fill();
        doc.restore();
      }
      doc.fontSize(9).fillColor(C.slate800).font("Helvetica");
      doc.text(truncateLine(row.itemName, 100), margin + tablePad, rowY + 7, {
        width: colItem - tablePad,
      });
      doc.text(row.quantity, margin + colItem, rowY + 7, { width: colQty, align: "right" });
      doc.text(row.unit, margin + colItem + colQty, rowY + 7, { width: colUnit });
      doc.text(row.rate, margin + colItem + colQty + colUnit, rowY + 7, {
        width: colRate,
        align: "right",
      });
      doc.text(row.lineTotal, margin + colItem + colQty + colUnit + colRate, rowY + 7, {
        width: colTot,
        align: "right",
      });
      doc
        .strokeColor(C.slate200)
        .lineWidth(0.35)
        .moveTo(margin, rowY + rowH)
        .lineTo(margin + innerW, rowY + rowH)
        .stroke();
      y = rowY + rowH;
    });

    y += 8;
    if (y > contentBottomY() - 120) {
      doc.addPage();
      drawTopAccent();
      y = margin + 12;
      drawPlanSyncTopRight(y);
      doc.x = margin;
      doc.y = y;
    }

    const totalsBoxW = 240;
    const totalsX = margin + innerW - totalsBoxW;
    const hasWorkFee = Boolean(input.workFeeLabel && input.workFeeAmount);
    const totalsBoxH = hasWorkFee ? 104 : 88;
    doc.save();
    doc
      .fillColor(C.slate50)
      .roundedRect(totalsX - 12, y - 6, totalsBoxW + 24, totalsBoxH, 6)
      .fill();
    doc
      .strokeColor(C.slate200)
      .lineWidth(0.5)
      .roundedRect(totalsX - 12, y - 6, totalsBoxW + 24, totalsBoxH, 6)
      .stroke();
    doc.restore();

    const rightX = totalsX;
    const labelW = 100;
    const valW = totalsBoxW - labelW;
    doc.fontSize(9).font("Helvetica").fillColor(C.slate600);
    doc.text("Subtotal", rightX, y, { width: labelW, align: "right" });
    doc
      .fillColor(C.slate900)
      .text(input.subtotal, rightX + labelW, y, { width: valW, align: "right" });
    y += 16;
    if (hasWorkFee) {
      doc
        .fillColor(C.slate600)
        .text(input.workFeeLabel!, rightX, y, { width: labelW, align: "right" });
      doc
        .fillColor(C.slate900)
        .text(input.workFeeAmount!, rightX + labelW, y, { width: valW, align: "right" });
      y += 16;
    }
    doc.fillColor(C.slate600).text(input.taxLabel, rightX, y, { width: labelW, align: "right" });
    doc
      .fillColor(C.slate900)
      .text(input.taxAmount, rightX + labelW, y, { width: valW, align: "right" });
    y += 16;
    doc.fillColor(C.slate600).text("Discount", rightX, y, { width: labelW, align: "right" });
    doc
      .fillColor(C.slate900)
      .text(input.discount, rightX + labelW, y, { width: valW, align: "right" });
    y += 18;
    doc
      .moveTo(rightX, y)
      .lineTo(rightX + totalsBoxW, y)
      .strokeColor(C.slate200)
      .lineWidth(0.75)
      .stroke();
    y += 10;
    doc.font("Helvetica-Bold").fontSize(12).fillColor(C.accent);
    doc.text("Total", rightX, y, { width: labelW, align: "right" });
    doc.text(input.total, rightX + labelW, y, { width: valW, align: "right" });
    y += 36;

    if (input.signerName || input.signedAtIso || input.signaturePngBuffer) {
      const pad = 14;
      const innerPad = margin + pad;
      const textW = innerW - pad * 2;
      const whenFormatted = input.signedAtIso
        ? formatProposalAcceptanceTimestamp(input.signedAtIso)
        : "";

      let boxH = pad + 22 + 6;
      if (input.signerName) {
        doc.font("Helvetica").fontSize(10);
        boxH += doc.heightOfString(`Signed by: ${input.signerName}`, { width: textW }) + 4;
      }
      if (input.signedAtIso) {
        doc.font("Helvetica-Bold").fontSize(9);
        boxH += doc.heightOfString("Signed on (UTC)", { width: textW }) + 2;
        doc.font("Helvetica").fontSize(10);
        boxH += doc.heightOfString(whenFormatted, { width: textW, lineGap: 2 }) + 6;
      }
      boxH += input.signaturePngBuffer?.length ? 88 : 8;
      boxH += pad;

      if (y > contentBottomY() - boxH) {
        doc.addPage();
        drawTopAccent();
        y = margin + 12;
        drawPlanSyncTopRight(y);
        doc.x = margin;
        doc.y = y;
      }

      const blockTop = y;
      doc.save();
      doc.fillColor(C.slate50).roundedRect(margin, blockTop, innerW, boxH, 8).fill();
      doc
        .strokeColor(C.slate200)
        .lineWidth(0.75)
        .roundedRect(margin, blockTop, innerW, boxH, 8)
        .stroke();
      doc.restore();

      y = blockTop + pad;
      const titleRowY = y;
      doc
        .fillColor(C.slate900)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("Acceptance", innerPad, titleRowY, { width: textW });
      y = titleRowY + 22 + 6;
      doc.font("Helvetica").fontSize(10).fillColor(C.slate700);
      if (input.signerName) {
        doc.text(`Signed by: ${input.signerName}`, innerPad, y, { width: textW });
        y = doc.y + 4;
      }
      if (input.signedAtIso) {
        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(C.slate500)
          .text("Signed on (UTC)", innerPad, y, { width: textW });
        y = doc.y + 2;
        doc.font("Helvetica").fontSize(10).fillColor(C.slate700).text(whenFormatted, innerPad, y, {
          width: textW,
          lineGap: 2,
        });
        y = doc.y + 6;
      }
      if (input.signaturePngBuffer && input.signaturePngBuffer.length > 0) {
        try {
          doc.image(input.signaturePngBuffer, innerPad, y, {
            width: 220,
            height: 80,
            fit: [220, 80],
          });
          y += 88;
        } catch {
          doc.text("(Signature image could not be embedded)", innerPad, y, { width: textW });
          y = doc.y + 8;
        }
      }
      y = blockTop + boxH + 8;
    }

    doc.end();
  });
}

export function dataUrlToPngBuffer(dataUrl: string): Buffer | null {
  const m = /^data:image\/png;base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  try {
    return Buffer.from(m[1]!, "base64");
  } catch {
    return null;
  }
}
