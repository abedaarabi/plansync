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
export function computeProposalTotals(opts) {
    const sub = opts.subtotal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const taxAmount = sub
        .mul(opts.taxPercent)
        .div(100)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const disc = opts.discount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const total = sub.add(taxAmount).sub(disc).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    return { taxAmount, total };
}
