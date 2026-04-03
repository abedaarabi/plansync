import PDFDocument from "pdfkit";
import sanitizeHtml from "sanitize-html";
function plainFromHtml(html) {
    return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
        .replace(/\s+/g, " ")
        .trim();
}
function truncateLine(s, max) {
    const t = s.replace(/\s+/g, " ").trim();
    if (t.length <= max)
        return t;
    return `${t.slice(0, max - 1)}…`;
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
};
/** Matches frontend `public/logo-mark.svg` (two L-shapes). */
function drawPlansyncMark(doc, x, y, size) {
    const u = size / 48;
    doc.save();
    doc.fillColor(C.accent);
    doc.rect(x + 7 * u, y + 7 * u, 15 * u, 4 * u).fill();
    doc.rect(x + 7 * u, y + 11 * u, 4 * u, 11 * u).fill();
    doc.fillColor(C.accent);
    doc.opacity(0.38);
    doc.rect(x + 26 * u, y + 37 * u, 15 * u, 4 * u).fill();
    doc.rect(x + 37 * u, y + 26 * u, 4 * u, 11 * u).fill();
    doc.opacity(1);
    doc.restore();
}
/** PDFKit supports PNG, JPEG, GIF, WebP — not SVG. */
function isLikelyPdfKitRasterBuffer(buf) {
    if (buf.length < 12)
        return false;
    const b0 = buf[0];
    const b1 = buf[1];
    if (b0 === 0x89 && b1 === 0x50)
        return true;
    if (b0 === 0xff && b1 === 0xd8)
        return true;
    if (buf.subarray(0, 3).toString("ascii") === "GIF")
        return true;
    if (buf.subarray(0, 4).toString("ascii") === "RIFF" &&
        buf.subarray(8, 12).toString("ascii") === "WEBP") {
        return true;
    }
    return false;
}
function workspaceInitials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
    }
    const w = parts[0] ?? "?";
    return w.slice(0, 2).toUpperCase();
}
function drawWorkspaceLogoFallback(doc, x, y, box, workspaceName) {
    const initials = workspaceInitials(workspaceName);
    doc.save();
    doc.fillColor(C.slate50).roundedRect(x, y, box, box, 8).fill();
    doc.strokeColor(C.slate200).lineWidth(0.75).roundedRect(x, y, box, box, 8).stroke();
    doc.fillColor(C.accent).font("Helvetica-Bold").fontSize(box * 0.36);
    doc.text(initials, x, y + box * 0.28, { width: box, align: "center" });
    doc.restore();
}
function drawPoweredByPlansyncFooter(doc, pageW, pageH, margin) {
    const lineY = pageH - 42;
    const textY = pageH - 24;
    doc.save();
    doc.strokeColor(C.slate200).lineWidth(0.5).moveTo(margin, lineY).lineTo(pageW - margin, lineY).stroke();
    doc.restore();
    const markSize = 18;
    const part1 = "Powered by";
    const part2 = "PlanSync";
    doc.font("Helvetica").fontSize(8.5).fillColor(C.slate500);
    const w1 = doc.widthOfString(part1);
    const gap1 = 7;
    const gap2 = 7;
    doc.font("Helvetica-Bold");
    const w2 = doc.widthOfString(part2);
    const total = w1 + gap1 + markSize + gap2 + w2;
    const startX = (pageW - total) / 2;
    doc.font("Helvetica").fillColor(C.slate500).text(part1, startX, textY);
    const markY = textY - 13;
    drawPlansyncMark(doc, startX + w1 + gap1, markY, markSize);
    doc.font("Helvetica-Bold").fillColor(C.slate700).text(part2, startX + w1 + gap1 + markSize + gap2, textY);
}
export function buildProposalPdfBuffer(input) {
    return new Promise((resolve, reject) => {
        const sideMargin = 48;
        /** Extra bottom margin so PDFKit’s text wrap stops above the footer band (same as RFI-style layout). */
        const footerBand = 46;
        const doc = new PDFDocument({
            bufferPages: true,
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
        const chunks = [];
        doc.on("data", (c) => chunks.push(c));
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
        const drawTableHeader = (yTop) => {
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
        const logoBox = 58;
        const afterLogoGap = 12;
        const headerTextX = margin + logoBox + afterLogoGap;
        const headerTextW = innerW - logoBox - afterLogoGap;
        let workspaceLogoOk = false;
        if (input.logoImageBuffer?.length &&
            isLikelyPdfKitRasterBuffer(input.logoImageBuffer)) {
            try {
                doc.image(input.logoImageBuffer, margin, y, {
                    fit: [logoBox, logoBox],
                    width: logoBox,
                    height: logoBox,
                });
                workspaceLogoOk = true;
            }
            catch {
                workspaceLogoOk = false;
            }
        }
        if (!workspaceLogoOk) {
            drawWorkspaceLogoFallback(doc, margin, y, logoBox, input.workspaceName);
        }
        doc.fontSize(8).fillColor(C.accent).font("Helvetica-Bold").text("PROPOSAL", headerTextX, y, {
            characterSpacing: 1.2,
        });
        doc.fontSize(20).fillColor(C.slate900).text(input.title, headerTextX, y + 12, {
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
        const label = (lx, ly, t) => {
            doc.fontSize(7.5).fillColor(C.slate500).font("Helvetica-Bold").text(t, lx, ly);
        };
        const value = (lx, ly, t, w) => {
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
            doc.x = margin;
            doc.y = y;
        }
        doc.save();
        doc.fillColor(C.accent).rect(margin, y, 3, 14).fill();
        doc.restore();
        doc.fontSize(12).fillColor(C.slate900).font("Helvetica-Bold").text("Cover letter", margin + 10, y);
        y += 22;
        const letter = plainFromHtml(input.coverHtml);
        doc.fontSize(10).font("Helvetica").fillColor(C.slate700).text(letter || "—", margin, y, {
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
            doc.x = margin;
            doc.y = y;
        }
        doc.fontSize(12).fillColor(C.slate900).font("Helvetica-Bold").text("Price breakdown", margin, y);
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
            doc.strokeColor(C.slate200).lineWidth(0.35).moveTo(margin, rowY + rowH).lineTo(margin + innerW, rowY + rowH).stroke();
            y = rowY + rowH;
        });
        y += 8;
        if (y > contentBottomY() - 120) {
            doc.addPage();
            drawTopAccent();
            y = margin + 12;
            doc.x = margin;
            doc.y = y;
        }
        const totalsBoxW = 240;
        const totalsX = margin + innerW - totalsBoxW;
        doc.save();
        doc.fillColor(C.slate50).roundedRect(totalsX - 12, y - 6, totalsBoxW + 24, 88, 6).fill();
        doc.strokeColor(C.slate200).lineWidth(0.5).roundedRect(totalsX - 12, y - 6, totalsBoxW + 24, 88, 6).stroke();
        doc.restore();
        const rightX = totalsX;
        const labelW = 100;
        const valW = totalsBoxW - labelW;
        doc.fontSize(9).font("Helvetica").fillColor(C.slate600);
        doc.text("Subtotal", rightX, y, { width: labelW, align: "right" });
        doc.fillColor(C.slate900).text(input.subtotal, rightX + labelW, y, { width: valW, align: "right" });
        y += 16;
        doc.fillColor(C.slate600).text(input.taxLabel, rightX, y, { width: labelW, align: "right" });
        doc.fillColor(C.slate900).text(input.taxAmount, rightX + labelW, y, { width: valW, align: "right" });
        y += 16;
        doc.fillColor(C.slate600).text("Discount", rightX, y, { width: labelW, align: "right" });
        doc.fillColor(C.slate900).text(input.discount, rightX + labelW, y, { width: valW, align: "right" });
        y += 18;
        doc.moveTo(rightX, y).lineTo(rightX + totalsBoxW, y).strokeColor(C.slate200).lineWidth(0.75).stroke();
        y += 10;
        doc.font("Helvetica-Bold").fontSize(12).fillColor(C.accent);
        doc.text("Total", rightX, y, { width: labelW, align: "right" });
        doc.text(input.total, rightX + labelW, y, { width: valW, align: "right" });
        y += 36;
        if (input.signerName || input.signedAtIso || input.signaturePngBuffer) {
            if (y > contentBottomY() - 140) {
                doc.addPage();
                drawTopAccent();
                y = margin + 12;
                doc.x = margin;
                doc.y = y;
            }
            doc.save();
            doc.fillColor(C.slate50).roundedRect(margin, y, innerW, 120, 8).fill();
            doc.strokeColor(C.slate200).lineWidth(0.75).roundedRect(margin, y, innerW, 120, 8).stroke();
            doc.restore();
            y += 14;
            doc.fillColor(C.slate900).font("Helvetica-Bold").fontSize(11).text("Acceptance", margin + 14, y);
            y += 18;
            doc.font("Helvetica").fontSize(10).fillColor(C.slate700);
            if (input.signerName) {
                doc.text(`Signed by: ${input.signerName}`, margin + 14, y);
                y += 14;
            }
            if (input.signedAtIso) {
                doc.text(`Timestamp (UTC): ${input.signedAtIso}`, margin + 14, y);
                y += 14;
            }
            if (input.signaturePngBuffer && input.signaturePngBuffer.length > 0) {
                try {
                    doc.image(input.signaturePngBuffer, margin + 14, y, { width: 220, height: 80, fit: [220, 80] });
                    y += 88;
                }
                catch {
                    doc.text("(Signature image could not be embedded)", margin + 14, y);
                    y += 14;
                }
            }
        }
        const pageRange = doc.bufferedPageRange();
        for (let pi = 0; pi < pageRange.count; pi++) {
            doc.switchToPage(pageRange.start + pi);
            drawPoweredByPlansyncFooter(doc, pageW, doc.page.height, margin);
        }
        doc.end();
    });
}
export function dataUrlToPngBuffer(dataUrl) {
    const m = /^data:image\/png;base64,(.+)$/i.exec(dataUrl.trim());
    if (!m)
        return null;
    try {
        return Buffer.from(m[1], "base64");
    }
    catch {
        return null;
    }
}
