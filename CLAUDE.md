# HOMECOURT — Build Instructions for Claude

## What this is

HOMECOURT is a Kalshi/Polymarket-style prediction market for residential US real estate. Phase 0 = sweepstakes (play-money) MVP focused on Austin, TX. Users browse single-family listings, trade 5-bucket binary-range contracts ("Will 123 Oak St close in $625K–$675K by Sept 30?"), see live order books, hold positions, comment, and settle against a mock oracle.

## How to build

The full build specification is in `BUILD.md` (1,371 lines). Read it top-to-bottom. Execute milestones M1 → M12 in order from section 23. Do not skip ahead.

After each milestone:

1. Run the acceptance checks listed in BUILD.md section 23
2. `pnpm typecheck && pnpm lint && pnpm test` must pass
3. Commit with conventional message: `feat(m4): markets feed with filters`
4. Move to next milestone

## Hard rules (from BUILD.md)

- TypeScript strict everywhere, no `any` outside lib/api boundary
- No file >300 lines
- Tailwind utilities only, no .module.css
- shadcn for all primitives (Button/Input/Dialog/Sheet/Tabs/Tooltip/DropdownMenu/Command/Popover/Toast)
- All money = BIGINT cents in DB
- No `console.log` — use lib/log.ts
- Never use the words: bet, gamble, wager, odds, bookmaker, sportsbook, prop, juice, vig
- Always use: trade, contract, position, price, chance, market, fill, settle

## Stack (locked)

- Web: Next.js 15 App Router + React 19 + TS 5.6 strict + Tailwind 3.4 + shadcn/ui + TanStack Query + Zustand + lightweight-charts
- Backend: Go 1.22 matching engine + Supabase Postgres 15 + NATS JetStream + Node oracle worker
- Tooling: pnpm workspaces + Turbo + ESLint + Prettier + Husky + Vitest + Playwright

## Brady's defaults (from ~/.claude/CLAUDE.md)

- TypeScript everywhere
- Tailwind CSS for styling
- Functional components + hooks, early returns
- Files under 300 lines
- Run `npx tsc --noEmit` after .ts/.tsx changes
- No console.log in production

## Repo

- Local: `~/Desktop/homecourt`
- Remote: `github.com/Acuntel/homecourt` (private)

## The smoke-test gate

Build is complete only when all 10 flows in BUILD.md section 28 pass on a fresh deploy. See that section for the checklist.
