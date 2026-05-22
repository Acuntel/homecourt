# HOMECOURT

A Kalshi/Polymarket-style prediction market for residential US real estate.

**Phase 0:** Sweepstakes (play-money) MVP focused on Austin, TX. Users browse single-family listings, trade 5-bucket binary-range contracts ("Will 123 Oak St close in $625K–$675K by Sept 30?"), see live order books, hold positions, comment, and settle against a mock oracle.

## Stack

- **Web:** Next.js 15 App Router + React 19 + TS strict + Tailwind + shadcn/ui + TanStack Query + lightweight-charts
- **Engine:** Go 1.22 matching engine (CLOB + LS-LMSR house MM)
- **DB:** Supabase Postgres 15 + NATS JetStream
- **Oracle:** Node worker (mock settlement in Phase 0)

## Build

The full build specification is in [`BUILD.md`](./BUILD.md) (1,371 lines). It defines 12 milestones, exact stack versions, every component, all API endpoints, the database schema, and 10 smoke-test flows that must pass.

Execute milestone-by-milestone.

## Status

Building. Currently: M1 — Monorepo bootstrap.

## License

Proprietary. © 2026 HOMECOURT.
