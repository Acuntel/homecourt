// Postgres pool for the oracle worker. Single connection pool, lazily
// initialized from DATABASE_URL.

import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL not set");
  }
  pool = new Pool({
    connectionString: url,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on("error", (err: Error) => {
    log.error({ err: err.message }, "pg pool error");
  });
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Tiny structured logger — matches the engine's slog-style JSON shape.
type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, fields: Record<string, unknown>, msg: string): void {
  const entry = {
    time: new Date().toISOString(),
    level,
    msg,
    ...fields,
  };
  process.stdout.write(JSON.stringify(entry) + "\n");
}

export const log = {
  debug: (fields: Record<string, unknown>, msg: string): void => emit("debug", fields, msg),
  info: (fields: Record<string, unknown>, msg: string): void => emit("info", fields, msg),
  warn: (fields: Record<string, unknown>, msg: string): void => emit("warn", fields, msg),
  error: (fields: Record<string, unknown>, msg: string): void => emit("error", fields, msg),
};
