/**
 * HOMECOURT formatting helpers — money in cents, sweepstakes coins, and dates.
 * All money values internal to the app are BIGINT cents.
 */

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usdDetailedFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US");

/** Format an integer cents value as a USD currency string ("$625,000"). */
export function formatUsdCents(cents: number, opts?: { detailed?: boolean }): string {
  const dollars = cents / 100;
  if (opts?.detailed) return usdDetailedFormatter.format(dollars);
  return usdFormatter.format(dollars);
}

/** Format sweepstakes coin amounts (also stored as cents). */
export function formatCoins(cents: number): string {
  // 1 coin = 1 cent in Phase 0 sweepstakes math.
  return `${numberFormatter.format(Math.round(cents))} coins`;
}

/** Format a contract price (1..99 cents) as "55¢". */
export function formatPriceCents(priceCents: number): string {
  return `${Math.round(priceCents)}¢`;
}

/** Format a +/- percentage chip ("+4.2%", "-1.5%"). */
export function formatDeltaPct(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

/** Format a short date like "Sept 30". */
export function formatShortDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Closes in 4h 12m" / "Closing now" / "Closed". */
export function formatClosesIn(iso: string | Date, now: Date = new Date()): string {
  const target = typeof iso === "string" ? new Date(iso) : iso;
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "Closed";
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return "Closing now";
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `Closes in ${days}d ${hours}h`;
  return `Closes in ${hours}h ${minutes}m`;
}
