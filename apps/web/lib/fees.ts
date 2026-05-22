/**
 * Taker fee schedule for HOMECOURT — see BUILD.md §6b.
 * feeCents = round(0.07 * priceCents * (100 - priceCents) / 100) * qty
 */
export function calcFeeCents(priceCents: number, qty: number): number {
  if (priceCents < 1 || priceCents > 99) throw new Error("price out of range");
  if (qty <= 0) throw new Error("qty must be positive");
  const perShare = Math.round((0.07 * priceCents * (100 - priceCents)) / 100);
  return perShare * qty;
}
