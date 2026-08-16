import PDFDocument from "pdfkit";
import { getEmailBrandIconPngBytes } from "./emailBrandIcon.js";
const C = {
    primary: "#2563eb",
    ink: "#0f172a",
    body: "#334155",
    muted: "#64748b",
    faint: "#94a3b8",
    border: "#e2e8f0",
    surface: "#f8fafc",
    white: "#ffffff",
    pass: "#059669",
    passBg: "#ecfdf5",
    fail: "#dc2626",
    failBg: "#fef2f2",
    na: "#64748b",
    naBg: "#f1f5f9",
};
function sortInspectionLevelKeys(keys) {
    return [...keys].sort((a, b) => {
        const na = Number.parseInt(a, 10);
        const nb = Number.parseInt(b, 10);
        const aIsNum = !Number.isNaN(na) && String(na) === a.trim();
        const bIsNum = !Number.isNaN(nb) && String(nb) === b.trim();
        if (aIsNum && bIsNum)
            return na - nb;
        if (aIsNum)
            return -1;
        if (bIsNum)
            return 1;
        return a.localeCompare(b);
    });
}
function inspectionDataUrlToBuffer(dataUrl) {
    const m = /^data:image\/(png|jpe?g|webp);base64,([\s\S]+)$/i.exec(dataUrl.trim());
    if (!m)
        return null;
    try {
        return Buffer.from(m[2].replace(/\s/g, ""), "base64");
    }
    catch {
        return null;
    }
}
function formatUtc(d) {
    return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}
function formatLocalDate(d) {
    return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}
function outcomeLabel(o) {
    if (o === "pass")
        return "PASS";
    if (o === "fail")
        return "FAIL";
    if (o === "na")
        return "N/A";
    return "—";
}
function outcomeColors(o) {
    if (o === "pass")
        return { fg: C.pass, bg: C.passBg };
    if (o === "fail")
        return { fg: C.fail, bg: C.failBg };
    if (o === "na")
        return { fg: C.na, bg: C.naBg };
    return { fg: C.faint, bg: C.surface };
}
function personLabel(p) {
    if (!p)
        return "—";
    const n = p.name?.trim();
    if (n)
        return n;
    return p.email?.trim() || "—";
}
/**
 * Branded PlanSync inspection PDF: logo header, summary stats, sectioned checklist, photos.
 */
// fallow-ignore-next-line complexity
export async function buildInspectionReportPdfBuffer(run) {
    const margin = 44;
    const checklistRaw = Array.isArray(run.template.checklistJson)
        ? run.template.checklistJson
        : [];
    const checklist = checklistRaw.filter((it) => typeof it.id === "string" && it.id.length > 0);
    const results = Array.isArray(run.resultJson) ? run.resultJson : [];
    let passCount = 0;
    let failCount = 0;
    let naCount = 0;
    let unanswered = 0;
    let photoCount = 0;
    let noteCount = 0;
    for (const item of checklist) {
        const res = results.find((r) => r.itemId === item.id);
        const oc = (res?.outcome ?? "").toLowerCase();
        if (oc === "pass")
            passCount += 1;
        else if (oc === "fail")
            failCount += 1;
        else if (oc === "na")
            naCount += 1;
        else
            unanswered += 1;
        if (typeof res?.photoDataUrl === "string" && res.photoDataUrl.startsWith("data:image")) {
            photoCount += 1;
        }
        if (typeof res?.note === "string" && res.note.trim())
            noteCount += 1;
    }
    const total = checklist.length;
    const overall = failCount > 0 ? "Deficient" : unanswered > 0 ? "Incomplete" : total > 0 ? "Conforming" : "—";
    const chunks = [];
    const doc = new PDFDocument({
        margin,
        size: "LETTER",
        bufferPages: true,
        info: {
            Title: `Inspection — ${run.template.name}`,
            Author: "PlanSync",
            Subject: `${run.project.name} inspection report`,
            Creator: "PlanSync O&M",
        },
    });
    doc.on("data", (b) => chunks.push(b));
    const done = new Promise((resolve, reject) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
    });
    const contentW = doc.page.width - margin * 2;
    const pageBottom = () => doc.page.height - doc.page.margins.bottom;
    const logo = getEmailBrandIconPngBytes();
    const ensureSpace = (need) => {
        if (doc.y + need > pageBottom() - 12) {
            doc.addPage();
            doc.x = margin;
            // Continuation header strip
            doc.save();
            doc.rect(margin, margin - 8, contentW, 22).fill(C.surface);
            doc.fillColor(C.muted).font("Helvetica").fontSize(8);
            doc.text(`PlanSync · ${run.project.name} · ${run.template.name} (continued)`, margin + 8, margin - 2, { width: contentW - 16 });
            doc.restore();
            doc.y = margin + 22;
            doc.fillColor(C.ink);
        }
    };
    // —— Header with logo ——
    const headerTop = margin;
    const logoSize = 36;
    if (logo) {
        try {
            doc.image(logo, margin, headerTop, { width: logoSize, height: logoSize });
        }
        catch {
            /* ignore corrupt icon */
        }
    }
    const textLeft = logo ? margin + logoSize + 12 : margin;
    doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(18);
    doc.text("Plan", textLeft, headerTop + 2, { continued: true });
    doc.fillColor(C.primary).text("Sync");
    doc.fillColor(C.muted).font("Helvetica").fontSize(8);
    doc.text("Operations & Maintenance · Inspection report", textLeft, headerTop + 22, {
        width: contentW - (textLeft - margin),
    });
    // Overall status pill (right)
    const statusColors = overall === "Conforming"
        ? { fg: C.pass, bg: C.passBg }
        : overall === "Deficient"
            ? { fg: C.fail, bg: C.failBg }
            : { fg: C.muted, bg: C.surface };
    const statusW = 88;
    const statusX = margin + contentW - statusW;
    doc.save();
    doc.roundedRect(statusX, headerTop + 4, statusW, 22, 6).fill(statusColors.bg);
    doc.fillColor(statusColors.fg).font("Helvetica-Bold").fontSize(9);
    doc.text(overall.toUpperCase(), statusX, headerTop + 10, {
        width: statusW,
        align: "center",
    });
    doc.restore();
    doc.y = headerTop + logoSize + 14;
    doc
        .strokeColor(C.border)
        .lineWidth(1)
        .moveTo(margin, doc.y)
        .lineTo(margin + contentW, doc.y)
        .stroke();
    doc.moveDown(0.85);
    // —— Title ——
    doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(16);
    doc.text(run.template.name, { width: contentW });
    if (run.template.description?.trim()) {
        doc.moveDown(0.25);
        doc.fillColor(C.body).font("Helvetica").fontSize(9);
        doc.text(run.template.description.trim(), { width: contentW });
    }
    doc.moveDown(0.7);
    // —— Meta grid ——
    const metaRows = [
        ["Project", run.project.name],
        ["Template", run.template.name],
        ["Frequency", run.template.frequency?.trim() || "—"],
        ["Inspector", personLabel(run.createdBy)],
        ["Signed off by", personLabel(run.signedOffBy)],
        ["Started", formatLocalDate(run.createdAt)],
        [
            "Completed",
            run.completedAt ? `${formatLocalDate(run.completedAt)} (${formatUtc(run.completedAt)})` : "—",
        ],
        ["Status", run.status === "COMPLETED" ? "Closed" : run.status],
        [
            "Drawing",
            run.file?.name
                ? `${run.file.name}${run.fileVersion != null ? ` · v${run.fileVersion.version}` : ""}`
                : "—",
        ],
        ["Run ID", run.id],
        ["Generated", formatUtc(new Date())],
    ];
    const colGap = 16;
    const colW = (contentW - colGap) / 2;
    let metaY = doc.y;
    const metaStartY = metaY;
    doc.save();
    doc.roundedRect(margin, metaY - 4, contentW, 8 + metaRows.length * 14, 8).fill(C.surface);
    doc.restore();
    metaY += 6;
    for (let i = 0; i < metaRows.length; i += 2) {
        const left = metaRows[i];
        const right = metaRows[i + 1];
        doc.fillColor(C.muted).font("Helvetica").fontSize(7.5);
        doc.text(left[0].toUpperCase(), margin + 10, metaY, { width: colW - 20 });
        if (right) {
            doc.text(right[0].toUpperCase(), margin + colW + colGap + 10, metaY, {
                width: colW - 20,
            });
        }
        metaY += 10;
        doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(9);
        doc.text(left[1], margin + 10, metaY, { width: colW - 20 });
        if (right) {
            doc.text(right[1], margin + colW + colGap + 10, metaY, { width: colW - 20 });
        }
        metaY += 16;
    }
    doc.y = Math.max(metaY, metaStartY + 8 + metaRows.length * 14) + 10;
    // —— Summary stats ——
    ensureSpace(56);
    doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(11);
    doc.text("Summary", { width: contentW });
    doc.moveDown(0.45);
    const stats = [
        { label: "Items", value: String(total), fg: C.ink },
        { label: "Pass", value: String(passCount), fg: C.pass },
        { label: "Fail", value: String(failCount), fg: C.fail },
        { label: "N/A", value: String(naCount), fg: C.na },
        { label: "Photos", value: String(photoCount), fg: C.primary },
        { label: "Notes", value: String(noteCount), fg: C.body },
    ];
    const boxW = (contentW - 10 * (stats.length - 1)) / stats.length;
    const boxH = 38;
    const statsY = doc.y;
    stats.forEach((s, i) => {
        const x = margin + i * (boxW + 10);
        doc.save();
        doc.roundedRect(x, statsY, boxW, boxH, 6).fill(C.surface);
        doc.restore();
        doc.fillColor(C.muted).font("Helvetica").fontSize(7);
        doc.text(s.label.toUpperCase(), x + 6, statsY + 7, { width: boxW - 12, align: "center" });
        doc.fillColor(s.fg).font("Helvetica-Bold").fontSize(14);
        doc.text(s.value, x + 6, statsY + 18, { width: boxW - 12, align: "center" });
    });
    doc.y = statsY + boxH + 16;
    // —— Checklist by section ——
    const byLevel = new Map();
    for (const it of checklist) {
        const key = typeof it.level === "string" && it.level.trim().length > 0 ? it.level.trim() : "General";
        const list = byLevel.get(key) ?? [];
        list.push(it);
        byLevel.set(key, list);
    }
    const levelKeys = sortInspectionLevelKeys([...byLevel.keys()]);
    ensureSpace(28);
    doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(11);
    doc.text("Checklist results", { width: contentW });
    doc.moveDown(0.55);
    let itemNum = 0;
    for (const levelKey of levelKeys) {
        const items = byLevel.get(levelKey) ?? [];
        ensureSpace(36);
        const sectionTitle = Number.isFinite(Number(levelKey)) && String(Number(levelKey)) === levelKey.trim()
            ? `Section ${levelKey}`
            : levelKey;
        doc.save();
        doc.roundedRect(margin, doc.y, contentW, 20, 4).fill(C.primary);
        doc.fillColor(C.white).font("Helvetica-Bold").fontSize(9);
        doc.text(sectionTitle.toUpperCase(), margin + 10, doc.y + 6, { width: contentW - 20 });
        doc.restore();
        doc.y += 28;
        for (const item of items) {
            itemNum += 1;
            const res = results.find((r) => r.itemId === item.id);
            const oc = (res?.outcome ?? "").toLowerCase();
            const note = typeof res?.note === "string" ? res.note.trim() : "";
            const photo = typeof res?.photoDataUrl === "string" ? res.photoDataUrl : "";
            const photoFile = typeof res?.photoFileName === "string" && res.photoFileName.trim()
                ? res.photoFileName.trim()
                : "";
            const followUp = typeof res?.followUpIssueId === "string" && res.followUpIssueId.trim()
                ? res.followUpIssueId.trim()
                : "";
            const colors = outcomeColors(oc);
            const photoBuf = photo.startsWith("data:image") ? inspectionDataUrlToBuffer(photo) : null;
            const estimated = 52 + (note ? 22 : 0) + (followUp ? 14 : 0) + (photoBuf ? 170 : 0) + (photoFile ? 12 : 0);
            ensureSpace(estimated);
            const cardTop = doc.y;
            // Card background
            doc.save();
            doc.roundedRect(margin, cardTop, contentW, 8, 6).fill(C.white);
            doc.restore();
            // Outcome badge
            const badgeLabel = outcomeLabel(oc);
            const badgeW = 46;
            doc.save();
            doc.roundedRect(margin + contentW - badgeW - 8, cardTop + 6, badgeW, 16, 4).fill(colors.bg);
            doc.fillColor(colors.fg).font("Helvetica-Bold").fontSize(8);
            doc.text(badgeLabel, margin + contentW - badgeW - 8, cardTop + 9.5, {
                width: badgeW,
                align: "center",
            });
            doc.restore();
            doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(10);
            doc.text(`${itemNum}. ${item.label ?? item.id ?? "Item"}`, margin + 10, cardTop + 8, {
                width: contentW - badgeW - 28,
            });
            let y = doc.y + 4;
            doc.fillColor(C.muted).font("Helvetica").fontSize(8);
            const typeLabel = item.type === "text"
                ? "Text"
                : item.type === "photo"
                    ? "Photo"
                    : item.type === "checkbox"
                        ? "Checkbox"
                        : "Pass / Fail";
            doc.text(`Type: ${typeLabel}`, margin + 10, y, { width: contentW - 20 });
            y = doc.y + 3;
            if (note) {
                doc.fillColor(C.body).font("Helvetica").fontSize(9);
                doc.text(`Note: ${note}`, margin + 10, y, { width: contentW - 20 });
                y = doc.y + 3;
            }
            if (followUp) {
                doc.fillColor(C.primary).font("Helvetica").fontSize(8);
                doc.text(`Follow-up work order: ${followUp}`, margin + 10, y, {
                    width: contentW - 20,
                });
                y = doc.y + 3;
            }
            if (photoBuf) {
                if (photoFile) {
                    doc.fillColor(C.muted).font("Helvetica").fontSize(7.5);
                    doc.text(`Photo: ${photoFile}`, margin + 10, y, { width: contentW - 20 });
                    y = doc.y + 2;
                }
                try {
                    doc.image(photoBuf, margin + 10, y, {
                        fit: [contentW - 20, 150],
                    });
                    y = doc.y + 6;
                }
                catch {
                    doc.fillColor(C.faint).font("Helvetica").fontSize(8);
                    doc.text("Photo attached but could not be embedded.", margin + 10, y, {
                        width: contentW - 20,
                    });
                    y = doc.y + 4;
                }
            }
            // Card border
            const cardH = Math.max(36, y - cardTop + 6);
            doc.save();
            doc.lineWidth(0.8).strokeColor(C.border);
            doc.roundedRect(margin, cardTop, contentW, cardH, 6).stroke();
            // Left accent by outcome
            doc.fillColor(colors.fg);
            doc.rect(margin, cardTop + 4, 3, cardH - 8).fill();
            doc.restore();
            doc.y = cardTop + cardH + 8;
            doc.x = margin;
        }
    }
    if (checklist.length === 0) {
        doc.fillColor(C.muted).font("Helvetica").fontSize(10);
        doc.text("This template had no checklist items.", { width: contentW });
    }
    // —— Closing note ——
    ensureSpace(48);
    doc.moveDown(0.4);
    doc.save();
    doc.roundedRect(margin, doc.y, contentW, 36, 6).fill(C.surface);
    const noteY = doc.y + 8;
    doc.fillColor(C.body).font("Helvetica").fontSize(8);
    doc.text("Generated by PlanSync O&M. Outcomes: Pass = conforming, Fail = deficient (may create work orders), N/A = not applicable.", margin + 10, noteY, { width: contentW - 20 });
    doc.restore();
    doc.y = noteY + 32;
    // Page numbers + footer on every page
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const footerY = doc.page.height - 28;
        doc
            .strokeColor(C.border)
            .lineWidth(0.6)
            .moveTo(margin, footerY - 6)
            .lineTo(margin + contentW, footerY - 6)
            .stroke();
        doc.fillColor(C.faint).font("Helvetica").fontSize(7.5);
        doc.text("PlanSync · plansync.com", margin, footerY, { width: contentW / 2, align: "left" });
        doc.text(`Page ${i + 1} of ${range.count}`, margin, footerY, {
            width: contentW,
            align: "right",
        });
    }
    doc.end();
    return done;
}
