// HOMECOURT — central, server-only helper to fetch Supabase env vars.
// Throws if a required var is missing instead of returning undefined,
// so callers can safely treat the result as a non-null string.

export function supabaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return v;
}

export function supabaseAnonKey(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!v) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  return v;
}

export function supabaseServiceRoleKey(): string {
  const v = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!v) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return v;
}

export function sweepstakesStartingCoins(): number {
  const raw = process.env.SWEEPSTAKES_STARTING_COINS;
  const v = raw ? Number.parseInt(raw, 10) : 50_000;
  if (!Number.isFinite(v) || v <= 0) return 50_000;
  return v;
}
