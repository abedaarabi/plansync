import { sanitizeProposalTableHtml } from "./proposalSanitize.js";
export function formatMoneyAmount(amount, currency) {
    const n = Number(amount);
    if (!Number.isFinite(n))
        return amount;
    try {
        return new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: currency.length === 3 ? currency : "USD",
            maximumFractionDigits: 2,
        }).format(n);
    }
    catch {
        return `${currency} ${n.toFixed(2)}`;
    }
}
export function buildTakeoffTableHtml(input) {
    const th = 'style="text-align:left;padding:10px 12px;border-bottom:1px solid #e2e8f0;font:600 12px Inter,system-ui,sans-serif;color:#64748b;text-transform:uppercase;letter-spacing:0.04em"';
    const td = 'style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font:14px Inter,system-ui,sans-serif;color:#0f172a"';
    const tdNum = 'style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font:14px Inter,system-ui,sans-serif;color:#0f172a;text-align:right;white-space:nowrap"';
    const rows = input.items
        .map((it) => `<tr><td ${td}>${esc(it.itemName)}</td><td ${tdNum}>${esc(it.quantity)}</td><td ${td}>${esc(it.unit)}</td><td ${tdNum}>${esc(it.rate)}</td><td ${tdNum}>${esc(it.lineTotal)}</td></tr>`)
        .join("");
    const html = `<table style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden" cellpadding="0" cellspacing="0">
<thead><tr><th ${th}>Item</th><th ${th} style="text-align:right">Qty</th><th ${th}>Unit</th><th ${th} style="text-align:right">Rate</th><th ${th} style="text-align:right">Total</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot>
<tr><td colspan="4" style="text-align:right;padding:10px 12px;font:600 14px Inter,system-ui,sans-serif">Subtotal</td><td style="text-align:right;padding:10px 12px;font:600 14px Inter,system-ui,sans-serif">${esc(input.subtotal)}</td></tr>
<tr><td colspan="4" style="text-align:right;padding:10px 12px;font:14px Inter,system-ui,sans-serif">Tax (${esc(input.taxPercent)}%)</td><td style="text-align:right;padding:10px 12px;font:14px Inter,system-ui,sans-serif">${esc(input.taxAmount)}</td></tr>
<tr><td colspan="4" style="text-align:right;padding:10px 12px;font:14px Inter,system-ui,sans-serif">Discount</td><td style="text-align:right;padding:10px 12px;font:14px Inter,system-ui,sans-serif">${esc(input.discount)}</td></tr>
<tr><td colspan="4" style="text-align:right;padding:12px 12px;font:700 16px Inter,system-ui,sans-serif">Total</td><td style="text-align:right;padding:12px 12px;font:700 16px Inter,system-ui,sans-serif;color:#2563eb">${esc(input.total)}</td></tr>
</tfoot>
</table>`;
    return sanitizeProposalTableHtml(html);
}
function esc(s) {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
const VARS = {
    "client.name": (c) => c.clientName,
    "client.company": (c) => c.clientCompany ?? "",
    "project.name": (c) => c.projectName,
    "company.name": (c) => c.companyName,
    "user.name": (c) => c.userName,
    "user.title": (c) => c.userTitle,
    "proposal.total": (c) => c.proposalTotalFormatted,
    "proposal.expiry": (c) => c.proposalExpiryFormatted,
    "proposal.reference": (c) => c.proposalReference,
    "takeoff.table": (c) => c.takeoffTableHtml,
};
/** Replace {{var.name}} placeholders in template body. */
export function applyProposalTemplate(body, ctx) {
    let out = body;
    for (const [key, fn] of Object.entries(VARS)) {
        const re = new RegExp(`\\{\\{\\s*${key.replace(/\./g, "\\.")}\\s*\\}\\}`, "g");
        out = out.replace(re, () => fn(ctx));
    }
    return out;
}
