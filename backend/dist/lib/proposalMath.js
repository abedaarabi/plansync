import { Prisma } from "@prisma/client";
export function toDec(v) {
    if (v instanceof Prisma.Decimal)
        return v;
    return new Prisma.Decimal(String(v));
}
/** lineTotal = round(qty * rate, 2) */
export function lineTotalFor(qty, rate) {
    return qty.mul(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
export function sumLineTotals(items) {
    let s = new Prisma.Decimal(0);
    for (const it of items) {
        s = s.add(toDec(it.lineTotal));
    }
    return s.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
/**
 * Line-item subtotal + optional work % → taxable base; tax applies to that base; then subtract discount.
 */
export function proposalMoneyBreakdown(opts) {
    const sub = opts.lineSubtotal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const wpPct = opts.workPricePercent.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const workAmount = sub.mul(wpPct).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const taxableBase = sub.add(workAmount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const taxAmount = taxableBase
        .mul(opts.taxPercent)
        .div(100)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const disc = opts.discount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const total = taxableBase.add(taxAmount).sub(disc).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    return { workAmount, taxableBase, taxAmount, total };
}
