# HOMECOURT — Master Build Prompt (Production)

## Mission

Build HOMECOURT — a Kalshi/Polymarket-style prediction market for residential US real estate, Phase 0 sweepstakes (play-money) MVP focused on Austin TX. Users browse single-family listings, trade 5-bucket binary-range contracts ("Will 123 Oak St close in $625K–$675K by Sept 30?"), see live order books, hold positions, comment, and settle against a mock oracle. Ship a polished web app (Next.js 15) + Go matching engine + Supabase Postgres ledger that feels like Kalshi+Polymarket but for housing.

Success criteria (testable):
1. A stranger lands on `/`, creates an account, completes mock KYC, deposits sweepstakes coins, and places a trade in under 5 minutes wall-clock.
2. All 10 smoke-test flows in the Final Check pass on a fresh deploy with seeded data.
3. Lighthouse desktop ≥ 90 perf / 95 a11y / 100 SEO on `/`, `/markets`, `/markets/[slug]`.
4. `pnpm typecheck && pnpm lint && pnpm test && pnpm e2e` is green from a fresh clone.

Use sweepstakes vocabulary only. Never use: bet, gamble, wager, odds, bookmaker, sportsbook, prop, juice, vig. Always use: trade, contract, position, price, chance, market, fill, settle.

---

## How to Use This Prompt

You are the executing agent. You have file write, bash, and read tools.

- Work milestone by milestone (M1 → M12). Do not skip ahead.
- After each milestone, run its acceptance checks and confirm completion before moving on.
- Commit at the end of every milestone with a conventional commit message (e.g. `feat(m4): markets feed with filters`). Branch off `main`; one commit per milestone is fine.
- When blocked, prefer pragmatic stubs over asking. Leave a `// TODO(post-phase-0):` comment, ship, and move on.
- Follow the locked tech stack and folder structure exactly. Do not substitute libraries or versions.
- Treat sections 4–22 as binding specs. Treat sections 23–24 (Phase 1 backlog, milestones) as the execution plan.
- The Final Check (section 27) is the gate. The build is complete when all 10 smoke flows pass on a fresh deploy.

---

## Quickstart — run these BEFORE writing any code

```bash
# 1. Create the monorepo
mkdir homecourt && cd homecourt
git init
corepack enable && corepack prepare pnpm@9.12.0 --activate
pnpm init
cat > pnpm-workspace.yaml <<'YAML'
packages:
  - apps/*
  - services/oracle
  - packages/*
YAML
mkdir -p apps/web services/engine services/oracle packages/shared supabase/migrations supabase/seed .github/workflows

# 2. Scaffold the web app
cd apps/web
pnpm dlx create-next-app@15.0.3 . --ts --tailwind --eslint --app --src-dir=false --import-alias='@/*' --use-pnpm --no-git
# install full dependency list (see section 1a)
# install shadcn/ui components (see section 1b)
cd ../..

# 3. Scaffold the Go engine
cd services/engine
go mod init github.com/homecourt/engine
mkdir -p cmd/engine internal/{book,lmsr,ws,api,store,wal,auth,match}
# install Go deps (see section 1a)
cd ../..

# 4. Scaffold the oracle worker
cd services/oracle
pnpm init
pnpm add @supabase/supabase-js nats date-fns pino zod
pnpm add -D tsx typescript @types/node
cd ../..

# 5. Local infra
cat > docker-compose.yml <<'YAML'
services:
  nats:
    image: nats:2.10-alpine
    command: ["-js", "-m", "8222"]
    ports: ["4222:4222", "8222:8222"]
YAML
docker compose up -d nats

# 6. Supabase
brew install supabase/tap/supabase || true
cd supabase
supabase init
supabase link --project-ref kdijttsbffilhezrxlds
cd ..

# 7. Husky + commitlint
cd apps/web
pnpm add -D husky lint-staged @commitlint/cli @commitlint/config-conventional
pnpm exec husky init
echo 'pnpm exec lint-staged' > .husky/pre-commit
echo "module.exports = { extends: ['@commitlint/config-conventional'] };" > commitlint.config.cjs
echo 'pnpm exec commitlint --edit "$1"' > .husky/commit-msg
cd ../..

# 8. Verify
pnpm install
pnpm -F web dev   # confirm Next renders, then Ctrl-C
```

Now proceed milestone by milestone.

---

## 1. Tech Stack (locked — do not substitute)

Web: Next.js 15.0.x App Router with React Server Components and server actions; React 19.x; TypeScript 5.6.x strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`; Tailwind 3.4.x + `tailwindcss-animate`; shadcn/ui (Radix primitives, latest); `lucide-react`; `framer-motion` 11.x; `react-hook-form` 7.x + `zod` 3.23.x + `@hookform/resolvers`; `@tanstack/react-query` 5.x; `zustand` 4.x; `lightweight-charts` 4.x; `recharts` 2.x for sparklines; `date-fns` 3.x; `clsx`; `tailwind-merge`; `@supabase/supabase-js` 2.45.x + `@supabase/ssr` 0.5.x; `sonner` toasts; `next-themes` 0.3.x; `next-safe-action` 7.x for typed server actions.

Backend: Go 1.22.x matching engine; Supabase Postgres 15 project ref `kdijttsbffilhezrxlds`; NATS JetStream 2.10; Node 20.x oracle worker (TypeScript, `tsx` runner).

Tooling: pnpm 9.x workspaces; ESLint 9.x flat config; Prettier 3.x; Vitest 2.x + `@testing-library/react`; Playwright 1.47.x; Husky + lint-staged; `commitlint` conventional; `tsx` for scripts.

### 1a. Dependency Install Commands

From `apps/web`:

```bash
# core
pnpm add next@15.0.3 react@19.0.0 react-dom@19.0.0

# styling
pnpm add tailwindcss@3.4.13 tailwindcss-animate postcss autoprefixer clsx tailwind-merge class-variance-authority
pnpm add -D @tailwindcss/typography @tailwindcss/forms

# ui primitives + icons
pnpm add lucide-react framer-motion@11.11.0 sonner cmdk vaul
pnpm add @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tooltip @radix-ui/react-popover @radix-ui/react-tabs @radix-ui/react-select @radix-ui/react-toast @radix-ui/react-checkbox @radix-ui/react-switch @radix-ui/react-slider @radix-ui/react-avatar @radix-ui/react-label @radix-ui/react-progress @radix-ui/react-separator @radix-ui/react-toggle @radix-ui/react-toggle-group @radix-ui/react-radio-group @radix-ui/react-scroll-area

# forms + validation
pnpm add react-hook-form@7.53.0 zod@3.23.8 @hookform/resolvers@3.9.0

# data + state
pnpm add @tanstack/react-query@5.59.0 @tanstack/react-query-devtools zustand@4.5.5

# charts
pnpm add lightweight-charts@4.2.0 recharts@2.13.0

# supabase
pnpm add @supabase/supabase-js@2.45.4 @supabase/ssr@0.5.1

# utils
pnpm add date-fns@3.6.0 nanoid ulid isomorphic-dompurify

# theming + a11y
pnpm add next-themes@0.3.0

# server actions
pnpm add next-safe-action@7.9.0

# rate limiting
pnpm add @upstash/ratelimit @upstash/redis lru-cache

# observability
pnpm add pino pino-pretty

# dev
pnpm add -D typescript@5.6.2 @types/node@20 @types/react@19 @types/react-dom@19
pnpm add -D eslint@9.11.0 @eslint/js typescript-eslint eslint-config-next prettier@3.3.3 prettier-plugin-tailwindcss
pnpm add -D vitest@2.1.1 @testing-library/react@16.0.1 @testing-library/jest-dom @testing-library/user-event happy-dom
pnpm add -D @playwright/test@1.47.2
pnpm add -D husky lint-staged @commitlint/cli @commitlint/config-conventional
pnpm add -D tsx@4.19.1 dotenv-cli
```

From `services/engine` (Go):

```bash
go get github.com/gorilla/websocket@v1.5.3
go get github.com/nats-io/nats.go@v1.37.0
go get github.com/jackc/pgx/v5@v5.7.1
go get github.com/golang-jwt/jwt/v5@v5.2.1
go get github.com/google/uuid@v1.6.0
go get github.com/rs/zerolog@v1.33.0
go get github.com/stretchr/testify@v1.9.0
```

From `services/oracle`:

```bash
pnpm add @supabase/supabase-js nats date-fns pino zod
pnpm add -D tsx typescript @types/node
```

### 1b. shadcn/ui install

```bash
cd apps/web
npx shadcn@latest init -d
npx shadcn@latest add button input label form textarea checkbox switch select radio-group slider \
  dialog sheet drawer dropdown-menu popover tooltip tabs toast sonner \
  card badge avatar separator skeleton scroll-area progress \
  table command alert alert-dialog accordion breadcrumb \
  navigation-menu hover-card toggle toggle-group resizable
```

---

## 2. Folder Structure

```
homecourt/
├── apps/
│   └── web/                          # Next.js 15 app
│       ├── app/
│       │   ├── (marketing)/page.tsx
│       │   ├── (marketing)/how-it-works/page.tsx
│       │   ├── (marketing)/legal/page.tsx
│       │   ├── (app)/markets/page.tsx
│       │   ├── (app)/markets/[slug]/page.tsx
│       │   ├── (app)/markets/[slug]/loading.tsx
│       │   ├── (app)/markets/[slug]/error.tsx
│       │   ├── (app)/markets/[slug]/not-found.tsx
│       │   ├── (app)/markets/[slug]/opengraph-image.tsx
│       │   ├── (app)/portfolio/page.tsx
│       │   ├── (app)/portfolio/activity/page.tsx
│       │   ├── (app)/portfolio/settings/page.tsx
│       │   ├── (app)/watchlist/page.tsx
│       │   ├── api/...
│       │   ├── opengraph-image.tsx
│       │   ├── robots.ts
│       │   ├── sitemap.ts
│       │   ├── error.tsx
│       │   ├── not-found.tsx
│       │   └── layout.tsx
│       ├── components/
│       ├── lib/
│       ├── hooks/
│       ├── stores/
│       ├── styles/
│       ├── scripts/
│       ├── tests/
│       └── e2e/
├── services/
│   ├── engine/                       # Go
│   │   ├── cmd/engine/main.go
│   │   ├── internal/book/book.go
│   │   ├── internal/lmsr/lmsr.go
│   │   ├── internal/ws/hub.go
│   │   ├── internal/api/http.go
│   │   ├── internal/store/pg.go
│   │   ├── internal/wal/nats.go
│   │   ├── internal/auth/jwt.go
│   │   ├── internal/match/engine.go
│   │   └── go.mod
│   └── oracle/                       # Node/TS worker
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── seed/
├── packages/
│   └── shared/                       # shared zod schemas, types
├── .github/workflows/
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── turbo.json (optional)
```

Hard rule: no file exceeds 300 lines. Split components if larger.

---

## 3. Design System

### 3a. Tailwind tokens (`apps/web/tailwind.config.ts`)

Colors:
- `court` (brand / YES): `50 #ECFDF5 … 500 #10B981 … 900 #064E3B`
- `cobalt` (BUY / link): `500 #1F4FFF`, `600 #1B45E0`
- `no` (NO / sell / destructive): `500 #EF4444`, `600 #DC2626`
- `ink`: `50 #F7F8FA … 900 #0F1116 … 950 #080A0E` (dark theme base)
- `paper`: `50 #FFFFFF … 100 #F4F5F7` (light theme surfaces)
- `warn`: `500 #F59E0B`
- `info`: `500 #3B82F6`

Fonts: Inter Variable (sans), JetBrains Mono Variable (mono). Both self-hosted via `next/font/google` with `display: swap`, preloaded subset `latin`.

Type scale (8 steps): `xs 12/16`, `sm 13/18`, `base 14/20`, `md 15/22`, `lg 17/24`, `xl 20/28`, `2xl 24/32`, `3xl 32/40`, `4xl 44/52`. Numbers: `font-mono tabular-nums tracking-tight`.

Grid: 4px base. Radii: `sm 6 / md 10 / lg 14 / xl 20 / full 9999`. Shadows: `sm 0 1 2 rgba(0,0,0,.08)`, `md 0 4 12 rgba(0,0,0,.10)`, `lg 0 12 32 rgba(0,0,0,.18)`.

### 3b. CSS variables (`apps/web/app/globals.css`)

```css
:root {
  --bg: 255 255 255;
  --fg: 15 17 22;
  --muted: 244 245 247;
  --muted-fg: 100 116 139;
  --border: 226 232 240;
  --card: 255 255 255;
  --primary: 16 185 129;
  --primary-fg: 255 255 255;
  --destructive: 239 68 68;
  --ring: 16 185 129;
  --radius: 0.625rem;
}
.dark {
  --bg: 8 10 14;
  --fg: 226 232 240;
  --muted: 22 26 33;
  --muted-fg: 148 163 184;
  --border: 30 36 47;
  --card: 15 17 22;
  --primary: 16 185 129;
  --primary-fg: 6 24 19;
  --destructive: 239 68 68;
  --ring: 16 185 129;
}
```

`next-themes` wired in `app/layout.tsx` with `<ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>`. Toggle in TopNav user menu only. Use `suppressHydrationWarning` on `<html>` to avoid first-paint flash.

### 3c. Mobile-responsive breakpoints

- `sm 640px`: TradePanel collapses to bottom sheet, OrderBook hidden behind tab, MarketCard goes single-column.
- `md 768px`: MarketCard grid 2-col, OrderBook returns inline, TopNav SearchBar becomes inline.
- `lg 1024px`: MarketCard grid 3-col, MarketDetailPage 2-col layout (chart left, panel right), CommentsThread side-anchored.
- `xl 1280px`: MarketCard grid 4-col, full 3-pane MarketDetail (chart / book / trade).
- `2xl 1536px`: max content width 1440px centered.

Touch targets ≥ 44px on `sm`. All hover-only affordances must have tap equivalents.

---

## 4. Database Schema

All money in BIGINT cents. UUIDs for ids. Timestamps `timestamptz` UTC. RLS enabled on every table; service-role bypass for engine and oracle workers.

### 4a. Tables (write all in `supabase/migrations/0001_init.sql`)

- `users`: `id uuid pk`, `email citext unique`, `phone text`, `username citext unique`, `display_name text`, `kyc_status enum('none','pending','approved','rejected')`, `created_at`, `last_seen_at`.
- `properties`: `id uuid pk`, `address text`, `city text`, `state char(2)`, `zip text`, `lat numeric(9,6)`, `lng numeric(9,6)`, `beds int`, `baths numeric(3,1)`, `sqft int`, `year_built int`, `lot_sqft int`, `zestimate_cents bigint`, `photos jsonb`, `geo point`.
- `listings`: `id uuid pk`, `property_id fk`, `mls_id text`, `list_price_cents bigint`, `list_date date`, `status enum('active','pending','closed','cancelled')`.
- `markets`: `id uuid pk`, `slug text unique`, `property_id fk`, `listing_id fk`, `kind text default 'binary_range_5'`, `buckets jsonb` (array of `{label, low_cents, high_cents}`), `opens_at timestamptz`, `closes_at timestamptz`, `resolves_at timestamptz`, `state enum('upcoming','open','closing','settled','voided')`, `oracle_source text`, `final_price_cents bigint`, `final_bucket int`.
- `accounts`: `id uuid pk`, `user_id fk unique`, `cash_cents bigint`, `locked_cents bigint`.
- `orders`: `id uuid pk`, `client_idempotency_key text unique`, `market_id fk`, `user_id fk`, `outcome int`, `side enum('buy','sell')`, `price_cents int check (price_cents between 1 and 99)`, `qty int`, `filled_qty int default 0`, `status enum('open','partial','filled','cancelled','expired')`, `created_at`, `cancelled_at`.
- `fills`: `id uuid pk`, `market_id fk`, `taker_order_id fk`, `maker_order_id fk`, `outcome int`, `price_cents int`, `qty int`, `fee_cents int`, `created_at`.
- `journal` (partitioned monthly): `id bigserial`, `user_id fk`, `market_id fk nullable`, `kind enum('deposit','withdraw','order_lock','order_release','fill_debit','fill_credit','fee','settlement','adjustment')`, `amount_cents bigint`, `balance_after_cents bigint`, `ref text`, `created_at`.
- `positions` (materialized view, refreshed on fill): `user_id`, `market_id`, `outcome`, `qty`, `avg_cost_cents`, `realized_pnl_cents`.
- `watchlist`: `user_id fk`, `market_id fk`, `created_at`, pk `(user_id, market_id)`.
- `comments`: `id uuid pk`, `market_id fk`, `user_id fk`, `parent_id uuid nullable`, `body text check (length(body)<=600)`, `score int default 0`, `created_at`, `deleted_at nullable`.
- `comment_votes`: `comment_id fk`, `user_id fk`, `value smallint check (value in (-1,1))`, pk `(comment_id,user_id)`.
- `settlements`: `id uuid pk`, `market_id fk unique`, `final_price_cents bigint`, `final_bucket int`, `oracle_payload jsonb`, `created_at`.
- `notifications`: `id uuid pk`, `user_id fk`, `kind enum('fill','settle','market_open','market_close','reply','mention','deposit')`, `payload jsonb`, `read_at timestamptz nullable`, `created_at`. Index `(user_id, read_at, created_at desc)`.
- `engine_snapshots`: `id bigserial pk`, `market_id fk`, `taken_at timestamptz default now()`, `book jsonb` (full L2 both sides per outcome), `lmsr_state jsonb` (alpha, b, q-vector), `last_seq bigint`. Index `(market_id, taken_at desc)`.
- `idempotency_keys`: `key text pk`, `response jsonb`, `created_at timestamptz default now()`. TTL via background sweep (24h).

### 4b. RLS policies

- `users`: select own row only; service-role full.
- `accounts`: select own row only.
- `orders`: select own only; insert through server action only (server enforces).
- `journal`: select own only.
- `markets`, `properties`, `listings`: public read.
- `comments`: public read of non-deleted; insert if `auth.uid() = user_id`; update only `deleted_at` by author.
- `watchlist`, `notifications`: own rows only.

### 4c. Migration files

- `0001_init.sql` — tables, enums, indexes.
- `0002_rls.sql` — policies.
- `0003_seed_helpers.sql` — functions (`refresh_positions()`, `sold_within_days(int)`).
- `0004_notifications_engine_snapshots.sql` — already merged into 0001 for new builds, kept as separate file for migration replay.

---

## 5. Supabase Setup

```bash
brew install supabase/tap/supabase
cd supabase
supabase init
supabase link --project-ref kdijttsbffilhezrxlds

supabase migration new init
# paste schema into supabase/migrations/0001_init.sql
supabase migration new rls
supabase migration new seed_helpers
supabase migration new notifications_engine_snapshots

supabase db push

# regenerate TS types
supabase gen types typescript --project-id kdijttsbffilhezrxlds --schema public > apps/web/lib/db/types.ts

# seed
pnpm -F web tsx scripts/seed.ts
```

`scripts/seed.ts` inserts: 6 demo users (`demo1@homecourt.test` … `demo6@homecourt.test`, password `Homecourt!2026`), 120 Austin properties across the 9 ZIPs, 120 active listings, 120 open markets (`binary_range_5`), 80 comments distributed across 30 random markets, 50 seed orders per market (LMSR-quoted) for initial book depth, 50,000 starting coins per demo account credited via `journal` `deposit` entries.

---

## 6. API Endpoints

### 6a. REST

Auth: `POST /api/auth/signup`, `/login`, `/verify-email`, `/verify-phone`, `/logout`.

KYC: `POST /api/kyc/submit`.

Funding: `POST /api/funding/plaid/link-token` (returns mock token), `/deposit`, `/withdraw`.

Markets: `GET /api/markets?zip=&minPrice=&maxPrice=&beds=&sort=closing|volume|new&cursor=&limit=24`; `GET /api/markets/:slug`; `/orderbook`; `/candlesticks?interval=1m|5m|1h|1d`; `/trades?limit=50`; `/comments?cursor=`.

Comments: `POST /api/markets/:slug/comments` (`{body, parentId?}`); `POST /api/comments/:id/vote` (`{value: -1|1}`).

Orders: `POST /api/orders` (`{marketSlug, outcome, side, priceCents, qty, idempotencyKey}`); `DELETE /api/orders/:id`.

Portfolio: `GET /api/portfolio/positions`, `/balance`, `/fills`, `/settlements`, `/export.csv`.

Watchlist: `POST /api/watchlist/:slug`, `DELETE /api/watchlist/:slug`.

Notifications: `GET /api/notifications?cursor=`, `POST /api/notifications/mark-read` (`{ids:[]}` or `{all:true}`).

WS: `GET /api/ws` (WebSocket upgrade to engine).

### 6b. Fees

`feeCents = round(0.07 * priceCents * (100 - priceCents) / 100) * qty` — applied to taker side only; show in `<FeeTooltip>` before placing.

### 6c. Idempotency

Header `Idempotency-Key: hcrt_order_<uuid>` required for `POST /api/orders` and `POST /api/funding/deposit`. Format: `hcrt_<resource>_<uuidv4>`. TTL 24h in `idempotency_keys` Postgres table. Conflict (same key, different body): `409 idempotency_key_conflict`. Same key, same body within TTL: return cached 2xx response.

### 6d. Rate limiting

Use `@upstash/ratelimit` with sliding window. Falls back to in-memory `lru-cache` if `UPSTASH_REDIS_REST_URL` unset (dev mode). Limits:
- `POST /api/orders`: 30/min/user
- `POST /api/auth/*`: 10/min/ip
- `POST /api/comments`: 20/min/user
- `GET /api/markets*`: 120/min/ip

Response headers on every limited route: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (unix). Over-limit returns `429 rate_limited` with `Retry-After` seconds.

---

## 7. WebSocket Wire Protocol

Client → server:
```json
{"type":"subscribe","channels":["orderbook:{slug}:{outcome}","ticker:{slug}","trade:{slug}","fill:user"]}
{"type":"unsubscribe","channels":["..."]}
{"type":"ping","ts":1730000000}
```

Server → client:
```json
{"type":"snapshot","channel":"orderbook:abc:2","seq":42,"data":{"bids":[[55,120],[54,80]],"asks":[[56,200],[57,90]]}}
{"type":"orderbook_delta","channel":"orderbook:abc:2","seq":43,"data":{"side":"bid","priceCents":55,"qty":140}}
{"type":"ticker","channel":"ticker:abc","seq":99,"data":{"outcome":2,"lastPriceCents":56,"volume24h":12000}}
{"type":"trade","channel":"trade:abc","seq":120,"data":{"outcome":2,"priceCents":56,"qty":10,"side":"buy","ts":1730000000}}
{"type":"fill","channel":"fill:user","seq":1,"data":{"orderId":"...","filledQty":10,"avgPriceCents":56,"feeCents":1480}}
{"type":"market_lifecycle","channel":"ticker:abc","seq":200,"data":{"state":"settled","finalBucket":2,"finalPriceCents":65000000}}
{"type":"pong","ts":1730000000}
{"type":"error","code":"unauthorized","message":"..."}
```

Reconnect with last `seq` per channel; server replays gap from in-memory ring buffer (≤500 events) or sends fresh snapshot. Auth via JWT in `Sec-WebSocket-Protocol` subprotocol or `?token=` query; expired token → close with code `4401`.

---

## 8. Components — Exact Specs

### 8a. Nav & Shell

- `TopNav`: logo left, `CategoryNav` center on `md+`, search + bell + avatar right. Keyboard `⌘K` opens `<CommandPalette>` (cmdk). Bell opens `<NotificationsDropdown>`.
- `CategoryNav`: pill buttons for All / Closing Soon / Highest Volume / Watchlist. `role="tablist"`, arrow-key navigation, `aria-selected`.
- `SearchBar`: 400ms debounce; queries `/api/markets?q=` typeahead; arrow-key + Enter to navigate.
- `BalancePill`: shows current cash; clicking opens `<DepositSheet>`. Animated count-up on change (framer-motion `useSpring`).

### 8b. Notifications

`<NotificationsDropdown>`: 320px wide, max-h `60vh`, scroll list of `<NotificationItem>`. Header "Notifications" + "Mark all read". Tabs: All / Unread. Each item: icon (kind), one-line copy, relative time, dot if unread. Empty: "You're all caught up." Polls `/api/notifications` every 30s + listens on `fill:user` WS channel.

Notification kinds & copy:
- `fill`: "Filled {qty} @ {avg}¢ on {marketShort}."
- `settle`: "Market settled. Final: ${price}. You {pnlVerb} {pnlAbs}."
- `market_open`: "{marketShort} just opened for trading."
- `market_close`: "{marketShort} closes in 1 hour."
- `reply`: "{user} replied to your comment."
- `mention`: "{user} mentioned you in {marketShort}."
- `deposit`: "Sweepstakes coins added: {amount}."

### 8c. MarketCard — full spec

```ts
type MarketCardProps = {
  slug: string;
  address: string;
  city: string;
  zip: string;
  thumbnailUrl: string;
  closesAt: string;        // ISO
  state: 'upcoming' | 'open' | 'closing' | 'settled';
  topOutcome: { label: string; priceCents: number; deltaPct: number };
  volume24hCents: number;
  watching?: boolean;
  variant?: 'default' | 'compact' | 'horizontal';
  onWatchToggle?: (slug: string) => void;
};
```

Layout: 16:10 photo top, 12px padding below, address line `text-base font-medium truncate`, ZIP + closes-in line `text-xs text-muted-fg`, primary outcome row `text-2xl font-mono tabular-nums` + delta chip, footer row volume + watch heart. `variant='compact'` removes volume row; `variant='horizontal'` lays photo left 40% width.

States: hover → border `court-500/40` + shadow-md + 1.01 scale (framer); focus-visible ring; pressed scale 0.99; loading uses `<MarketCardSkeleton>`; settled overlays badge "Settled — final $X".

### 8d. OrderBookL2

Two-column ladder (bids left, asks right), 12 rows each side, cumulative depth bar (subtle bg fill), mid-price chip centered. Click row prefills `<TradePanel>` price+qty. Tooltip on hover shows total notional + count of orders.

### 8e. Loading skeletons

- `<MarketCardSkeleton>`: 16:10 `Skeleton` block + 3 stacked lines (60%/40%/30% width). Shimmer: `animate-pulse` 2s ease-in-out infinite.
- `<OrderBookL2Skeleton>`: 12 alternating-row skeleton bars per side, height 24px, gap 4px; mid-chip pulsing.
- `<PortfolioPositionsTableSkeleton>`: 6 rows × 6 cols skeleton bars; header static.
- `<PriceChartSkeleton>`: rect block w-full h-[320px] with 3 horizontal gridline placeholders.
- `<CommentsThreadSkeleton>`: 5 stacked comment skeletons (avatar 32×32 + 2 lines).

Timing: keep skeleton ≥150ms even on fast loads to avoid flash; fade-out 120ms.

### 8f. Empty states

- Markets feed: "No markets match those filters. Try widening your search."
- Watchlist: "Nothing watched yet. Tap the heart on any market to follow it."
- Portfolio positions: "You don't hold any contracts yet. Browse markets to place your first trade."
- Activity: "No activity yet. Your trades and settlements will appear here."
- Order book: "No resting orders on this side. Be the first to make the price."
- Comments: "Be the first to start the conversation."
- Notifications: "You're all caught up."
- Search results: "No matches for '{q}'. Try an address, ZIP, or city."
- Fills: "No fills yet today."
- Settlements: "No settled markets in your history."

### 8g. CompsPanel

`<CompsPanel marketSlug>`: shows 3 nearest sold comps by haversine distance, listing for each: thumb, address, sold price, $/sqft, distance, delta vs subject `$/sqft` color-coded (green if subject lower, red if higher). Data from `properties` filtered `status='closed'` + `sold_within_days(180)`. Below table: "Subject $/sqft: ${x} · Comp median: ${y} · Δ {pct}%".

### 8h. PhotoGallery

`<PhotoGallery photos>`: hero photo 16:10 with prev/next chevrons; thumbnail strip below (8 max); click opens fullscreen `<Lightbox>` (Radix Dialog) with arrow-key + swipe nav, `Esc` close, `aria-roledescription="carousel"`, focus trap, slide counter "3 / 8". Preload neighbor photos via `next/image priority` for current + 1.

### 8i. Other components

`MarketDetailHeader`, `MarketPriceBlock`, `PriceChart` (lightweight-charts), `MultiOutcomeTable`, `OutcomeChip`, `RecentTradesTable`, `HoldersLeaderboard`, `CommentsThread`, `ResolutionCard`, `SettlementSourceBadge`, `TradePanel`, `TradeConfirmModal`, `FeeTooltip`, `SlippageWarning`, `PortfolioPositionsTable`, `ActivityFeed`, `SettingsPanel`, `ApiKeyManager`, `Toast` — all backed by shadcn primitives.

---

## 9. User Flows

Ten flows, each end-to-end on seeded data:

1. **Onboard + first trade** — landing → signup → KYC wizard → deposit → market → place trade → confirm → portfolio reflects.
2. **Browse + filter feed** — `/markets` → apply ZIP + price + sort filters → URL updates → cards refetch.
3. **Deposit** — BalancePill click → DepositSheet → enter amount → submit → animated count-up + journal row.
4. **Place limit order** — TradePanel → set price/qty → fee preview → confirm modal → toast + order appears in book.
5. **Cancel order** — Portfolio → open orders → cancel → balance restored + toast.
6. **Watchlist add/remove** — heart icon on card → `/watchlist` shows it → unheart removes.
7. **Comp panel + comment** — open market → CompsPanel renders 3 comps → post comment → appears with score 0.
8. **Orderbook live update** — two browsers: A places order → B's book updates < 500ms via WS.
9. **Mock oracle settlement** — fast-forward `resolves_at` → ResolutionCard + journal credits + notification.
10. **CSV export** — `/portfolio/export.csv` downloads file matching on-screen fills.

---

## 10. Matching Engine (Go)

Per-market goroutine with in-memory CLOB (price-time priority), separate book per outcome bucket. LS-LMSR market maker α=0.05, b=$500/market seeded from `zestimate`. Bounded loss b·ln(5) ≈ $805. Postgres snapshots every 5s into `engine_snapshots`. NATS JetStream WAL stream `engine.wal`. `gorilla/websocket`. JWT auth via Supabase JWKS.

### 10a. `services/engine/internal/book/book.go`

```go
package book

import (
	"sync"
	"time"

	"github.com/google/uuid"
)

type Side int8
const (
	Bid Side = 0
	Ask Side = 1
)

type Order struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	Side      Side
	PriceCent int32 // 1..99
	Qty       int64
	Remaining int64
	Created   time.Time
}

type level struct {
	price  int32
	orders []*Order // FIFO
	total  int64
}

type Book struct {
	mu   sync.RWMutex
	bids []*level // sorted desc by price
	asks []*level // sorted asc by price
}

func New() *Book { return &Book{} }

// Add inserts an order respecting price-time priority. Returns matched fills.
func (b *Book) Add(o *Order) []Fill {
	b.mu.Lock()
	defer b.mu.Unlock()
	fills := b.match(o)
	if o.Remaining > 0 {
		b.rest(o)
	}
	return fills
}

func (b *Book) Cancel(id uuid.UUID) bool { /* … */ return false }

func (b *Book) Snapshot(depth int) Snapshot { /* … */ return Snapshot{} }

type Fill struct {
	TakerID, MakerID uuid.UUID
	PriceCent        int32
	Qty              int64
	Ts               time.Time
}

type Snapshot struct {
	Bids, Asks [][2]int64 // [price, qty]
	Seq        uint64
}

func (b *Book) match(o *Order) []Fill { /* price-time match loop */ return nil }
func (b *Book) rest(o *Order)         { /* insert into level, FIFO append */ }
```

### 10b. `services/engine/internal/lmsr/lmsr.go`

```go
package lmsr

import "math"

type State struct {
	Alpha float64   // 0.05
	B     float64   // dynamic, derived from sum(q)
	Q     []float64 // outstanding shares per outcome (len = 5)
}

func New(initialB float64, n int) *State {
	return &State{Alpha: 0.05, B: initialB, Q: make([]float64, n)}
}

// Cost returns the LS-LMSR cost function value.
func (s *State) Cost() float64 {
	sumQ := 0.0
	for _, q := range s.Q { sumQ += q }
	b := s.Alpha * sumQ
	if b < s.B { b = s.B }
	num := 0.0
	for _, q := range s.Q { num += math.Exp(q / b) }
	return b * math.Log(num)
}

// Price returns instantaneous price (0..1) of outcome i.
func (s *State) Price(i int) float64 {
	sumQ := 0.0
	for _, q := range s.Q { sumQ += q }
	b := s.Alpha * sumQ
	if b < s.B { b = s.B }
	denom := 0.0
	for _, q := range s.Q { denom += math.Exp(q / b) }
	return math.Exp(s.Q[i]/b) / denom
}

// BuyCost returns the cost to buy `dq` shares of outcome i.
func (s *State) BuyCost(i int, dq float64) float64 {
	before := s.Cost()
	s.Q[i] += dq
	after := s.Cost()
	s.Q[i] -= dq
	return after - before
}
```

Remaining engine files: `internal/ws/hub.go` (subscribe/broadcast), `internal/api/http.go` (REST shim + `/ws` upgrade), `internal/store/pg.go` (pgx pool, snapshot/restore), `internal/wal/nats.go` (JetStream append + replay), `internal/auth/jwt.go` (JWKS verify against Supabase), `internal/match/engine.go` (per-market goroutine orchestrator), `cmd/engine/main.go` (wire deps + graceful shutdown on SIGTERM, draining WS, final snapshot).

---

## 11. Seed Data

120 synthetic Austin properties across ZIPs `78701/78702/78704/78745/78751/78757/78758/78759/73301`. 6 demo users (`demo1..demo6@homecourt.test`, password `Homecourt!2026`). 80 comments. LMSR-quoted markets.

Seed photo URLs (Unsplash, rotate across the 120 properties):

```
https://images.unsplash.com/photo-1568605114967-8130f3a36994
https://images.unsplash.com/photo-1570129477492-45c003edd2be
https://images.unsplash.com/photo-1600585154340-be6161a56a0c
https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83
https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6
https://images.unsplash.com/photo-1512917774080-9991f1c4c750
https://images.unsplash.com/photo-1572120360610-d971b9d7767c
https://images.unsplash.com/photo-1598228723793-52759bba239c
```

Append `?w=1280&q=80&auto=format&fit=crop` to each. Whitelist `images.unsplash.com` in `next.config.ts` `images.remotePatterns`.

---

## 12. Microcopy Bible

Toasts (success):
- "Account created. Welcome to HOMECOURT."
- "Email verified — you're in."
- "Phone verified."
- "KYC submitted. We'll let you know when it clears."
- "KYC approved."
- "Coins added — you're trading with sweepstakes credits."
- "Withdrawal requested. (Sweepstakes mode — no real funds move.)"
- "Order placed — watching the book."
- "Trade filled at avg {avg}¢."
- "Order cancelled. Funds released."
- "Added to watchlist."
- "Removed from watchlist."
- "Comment posted."
- "Notification preferences saved."
- "Theme updated."
- "API key generated. Copy it now — you won't see it again."
- "Exported {n} rows."

Toasts (error):
- "Couldn't reach the engine. Retrying…"
- "Order rejected — price out of range."
- "Not enough buying power. Add coins to keep trading."
- "Market closed while your order was in flight. No trade made."
- "Too many requests. Take a breath and try again."
- "Something went wrong. We logged it."

Confirm modal:
- Title: "Confirm trade"
- Body: "You're {side} {qty} shares of '{bucket}' at {priceCents}¢. Max risk {risk}. Max payout {payout}. Fee {fee}."
- Confirm CTA: "Place trade"
- Cancel CTA: "Back"

Slippage warning: "Price moved. Best ask is now {newPrice}¢. Re-confirm to trade."

Order form labels: "Outcome bucket" / "Side" / "Price (¢)" / "Quantity (shares)" / "Time in force"

Closing chip: "Closes in {hh}h {mm}m" / "Closing now" / "Closed"

Settlement card:
- "Settled. Final price: ${final}. Outcome: '{bucket}'."
- "Voided — settlement source unavailable. All orders refunded."

Footer (every page): "HOMECOURT Phase 0 is a free-to-play sweepstakes. No purchase necessary. Void where prohibited. Not securities. Not insurance. Not real estate brokerage."

Onboarding hero:
- H1: "Trade the price of every house in America."
- Sub: "Sweepstakes coins. Real-time order books. No brokers."
- CTA: "Start trading free"

CommandPalette empty: "Type an address, ZIP, or 'portfolio'."

Banned vocabulary: bet, gamble, wager, odds, bookmaker, sportsbook, prop, juice, vig.

---

## 13. Form Validation (zod schemas)

`packages/shared/schemas/auth.ts`:
```ts
export const signUpSchema = z.object({
  email: z.string().email("Enter a valid email."),
  username: z.string().min(3, "At least 3 characters.").max(20, "Max 20 characters.")
    .regex(/^[a-z0-9_]+$/i, "Letters, numbers, and underscores only."),
  password: z.string().min(10, "Use at least 10 characters.")
    .regex(/[A-Z]/, "Add an uppercase letter.")
    .regex(/[a-z]/, "Add a lowercase letter.")
    .regex(/[0-9]/, "Add a number."),
  acceptedTerms: z.literal(true, { errorMap: () => ({ message: "You must accept the terms." }) }),
});
```

`packages/shared/schemas/kyc.ts`:
```ts
export const kycSchema = z.object({
  legalFirstName: z.string().min(1, "Required."),
  legalLastName:  z.string().min(1, "Required."),
  dob: z.string().refine(s => /^\d{4}-\d{2}-\d{2}$/.test(s), "Use YYYY-MM-DD.")
    .refine(s => Date.now() - +new Date(s) > 18*365*864e5, "Must be 18+."),
  ssnLast4: z.string().regex(/^\d{4}$/, "Last 4 digits of SSN."),
  addressLine1: z.string().min(1, "Required."),
  city: z.string().min(1, "Required."),
  state: z.string().length(2, "2-letter state."),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, "Valid US ZIP."),
});
```

`packages/shared/schemas/deposit.ts`:
```ts
export const depositSchema = z.object({
  amountCents: z.coerce.number().int("Whole cents only.")
    .min(100, "Minimum 100 coins.")
    .max(1_000_000, "Maximum 1,000,000 coins per deposit."),
});
```

`packages/shared/schemas/order.ts`:
```ts
export const orderSchema = z.object({
  marketSlug: z.string().min(1),
  outcome: z.number().int().min(0).max(4),
  side: z.enum(["buy","sell"]),
  priceCents: z.number().int().min(1, "Min 1¢.").max(99, "Max 99¢."),
  qty: z.number().int().min(1, "At least 1 share.").max(10_000, "Max 10,000 shares per order."),
  idempotencyKey: z.string().regex(/^hcrt_order_[0-9a-f-]{36}$/),
});
```

Error keys → field copy rendered by `<FormMessage>` from shadcn form.

---

## 14. Accessibility Checklist

- Every form input has `<Label htmlFor>`; error rendered with `aria-describedby` + `aria-invalid="true"`.
- All buttons: visible text or `aria-label`; min target 44×44 on touch.
- Focus ring `ring-2 ring-court-500 ring-offset-2 ring-offset-ink-950`; never remove outline globally.
- TradePanel: arrow up/down adjusts price/qty by 1 (Shift = ×10).
- OrderBook rows: `role="button"` + Enter/Space to prefill; `aria-label="Bid 56¢ for 200 shares"`.
- Modals: Radix Dialog with `aria-labelledby` title + `aria-describedby` body, focus trap, `Esc` close, return focus to opener.
- Toaster: `aria-live="polite"` (success/info) or `assertive` (errors); auto-dismiss 5s + manual close button.
- Skip-link to `#main` at top of layout.
- Color contrast ≥ 4.5:1 body, ≥ 3:1 large; verified for both themes.
- Reduced motion: respect `prefers-reduced-motion` — disable framer transitions, freeze count-ups.
- Tables: `<caption>` + `<th scope>`; sortable columns announce `aria-sort`.
- Charts: provide `<figcaption>` summary + downloadable CSV link.
- Photo gallery: keyboard nav (←/→/Esc), focus trap inside lightbox.

---

## 15. Performance Budget

- Initial route JS budget: `/` ≤ 110 KB gzip; `/markets` ≤ 140 KB; `/markets/[slug]` ≤ 180 KB.
- LCP target ≤ 1.8s on simulated Fast 3G + 4× CPU throttle.
- Images: all via `next/image` with `sizes`; `priority` only on above-the-fold hero/photo; everything else `loading="lazy"`. Hero responsive `sizes="(max-width:768px) 100vw, 50vw"`.
- Fonts: `next/font/google` subset latin, `display: 'swap'`, preload only Inter regular + JetBrains Mono regular.
- Code-split heavy components: `lightweight-charts`, `recharts`, `<Lightbox>`, `<CompsPanel>` via `next/dynamic({ ssr:false, loading })`.
- TanStack Query: `staleTime: 30_000`, `gcTime: 5*60_000`; markets list `staleTime: 10_000`.
- Avoid CLS: reserve image aspect ratios; skeletons match final dimensions.

---

## 16. SEO & Metadata

`app/layout.tsx`:
```ts
export const metadata: Metadata = {
  metadataBase: new URL("https://homecourt.markets"),
  title: { default: "HOMECOURT", template: "%s · HOMECOURT" },
  description: "Trade the price of every house in America. Sweepstakes prediction markets for residential real estate.",
  openGraph: { type: "website", siteName: "HOMECOURT", images: ["/og-default.png"] },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};
```

`app/(app)/markets/[slug]/page.tsx`:
```ts
export async function generateMetadata({ params }): Promise<Metadata> {
  const m = await getMarketMeta(params.slug);
  if (!m) return { title: "Market not found" };
  return {
    title: `${m.address} — closes ${formatShortDate(m.closesAt)}`,
    description: `Trade the closing price of ${m.address}, ${m.city} ${m.zip}. Closes ${formatShortDate(m.closesAt)}.`,
    openGraph: { images: [`/markets/${m.slug}/opengraph-image`] },
    alternates: { canonical: `/markets/${m.slug}` },
  };
}
```

`app/(app)/markets/[slug]/opengraph-image.tsx` — generate 1200×630 via `ImageResponse` with address + bucket prices.

`app/robots.ts` returns `{ rules: [{ userAgent: "*", allow: "/", disallow: ["/api","/portfolio"] }], sitemap: "https://homecourt.markets/sitemap.xml" }`.

`app/sitemap.ts` lists `/`, `/how-it-works`, `/legal`, plus every open market slug.

Schema.org JSON-LD on market detail (`RealEstateListing`):
```ts
{
 "@context":"https://schema.org","@type":"RealEstateListing",
 "name":address,"address":{"@type":"PostalAddress","streetAddress":...,"addressLocality":city,"postalCode":zip,"addressRegion":"TX"},
 "numberOfRooms":beds,"floorSize":{"@type":"QuantitativeValue","value":sqft,"unitCode":"FTK"},
 "price":listPriceUsd,"priceCurrency":"USD"
}
```

---

## 17. Logging Strategy

`apps/web/lib/log.ts`:
```ts
import pino from "pino";
export const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { app: "homecourt-web", env: process.env.NODE_ENV, release: process.env.NEXT_PUBLIC_RELEASE },
  formatters: { level(l) { return { level: l }; } },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: ["req.headers.authorization","req.headers.cookie","*.password","*.ssnLast4"],
  transport: process.env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
});
```

Mandatory fields on every log line: `ts`, `level`, `msg`, `app`, `env`, `release`, `traceId` (per request via `headers().get('x-trace-id')` or generated nanoid), `userId` if authed, `route`. Engine logs use zerolog with identical field names. No `console.log` in production; ESLint rule `no-console: ['error', { allow: ['warn','error'] }]`.

---

## 18. Error Boundaries

`app/error.tsx` (global): "Something broke on our end. We're on it." + "Try again" button (resets) + "Go home" link. Logs to `log.error({err,digest})`.

`app/not-found.tsx`: "We couldn't find that page." + nav back.

`app/(app)/markets/[slug]/not-found.tsx`: "That market isn't here. It may have settled or been removed." + "Browse open markets".

`app/(app)/markets/[slug]/error.tsx`: "The order book hiccuped. Reconnecting…" with manual "Retry" + WS reconnection countdown.

`app/(app)/portfolio/error.tsx`: "Your positions are taking a sec to load." + retry.

All error files are client components (`'use client'`) and accept `({error, reset})`.

---

## 19. Analytics Events

`apps/web/lib/analytics.ts`:
```ts
export type AnalyticsEvent =
 | { name: "page_viewed"; payload: { path: string } }
 | { name: "market_viewed"; payload: { slug: string; outcome?: number } }
 | { name: "market_filter_applied"; payload: { filter: string; value: string } }
 | { name: "search_submitted"; payload: { q: string; results: number } }
 | { name: "sign_up_started"; payload: {} }
 | { name: "sign_up_completed"; payload: { userId: string } }
 | { name: "email_verified"; payload: { userId: string } }
 | { name: "kyc_submitted"; payload: { userId: string } }
 | { name: "kyc_approved"; payload: { userId: string } }
 | { name: "deposit_initiated"; payload: { amountCents: number } }
 | { name: "deposit_completed"; payload: { amountCents: number } }
 | { name: "order_placed"; payload: { slug: string; side: "buy"|"sell"; priceCents: number; qty: number } }
 | { name: "order_filled"; payload: { orderId: string; avgPriceCents: number; qty: number; feeCents: number } }
 | { name: "order_cancelled"; payload: { orderId: string } }
 | { name: "watchlist_added"; payload: { slug: string } }
 | { name: "watchlist_removed"; payload: { slug: string } }
 | { name: "comment_posted"; payload: { slug: string; parentId?: string } }
 | { name: "comment_voted"; payload: { commentId: string; value: -1|1 } }
 | { name: "settlement_viewed"; payload: { slug: string; finalBucket: number } }
 | { name: "csv_exported"; payload: { rows: number } };

export function track<E extends AnalyticsEvent>(e: E) {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "production") console.debug("[analytics]", e.name, e.payload);
}
```

Each event fires from exactly one place; document call site in JSDoc on the union member.

---

## 20. Theming Wiring

`app/layout.tsx`:
```tsx
<html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrains.variable}`}>
  <body className="bg-background text-foreground antialiased">
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <ReactQueryProvider>
        <Toaster richColors closeButton position="top-right" />
        {children}
      </ReactQueryProvider>
    </ThemeProvider>
  </body>
</html>
```

Theme toggle uses `useTheme()` from `next-themes`; hydration-safe via `useMounted()` to avoid SSR mismatch.

---

## 21. Constraints

- Strict TypeScript, zero `any`.
- `tsc/lint/test` must be green per milestone.
- No file > 300 lines — split component if larger.
- Tailwind utilities only — no inline `style` except dynamic CSS vars.
- shadcn for primitives.
- `react-hook-form` + `zod` for every form.
- All money is BIGINT cents.
- No `console.log` — use `lib/log`.
- TanStack Query for every async fetch.
- ARIA labels mandatory.
- Focus ring `ring-2 ring-court-500`.
- Conventional commits enforced by `commitlint`.
- Pre-commit runs `lint-staged` (ESLint + Prettier on staged files).

---

## 22. NOT in Phase 0 (Phase 1 Backlog)

Defer the following to Phase 1; do not build in Phase 0:

- Real KYC / money / Plaid / Stripe integration.
- CFTC compliance copy.
- Mobile native app (Capacitor or otherwise).
- Real settlement oracle (MLS feed, county records).
- Anti-collusion / wash-trade detection.
- Public B2B API + API key auth.
- Multi-market kinds beyond `binary_range_5` (scalar, categorical, conditional).
- Push notifications (in-app toasts + bell only in Phase 0).
- Affiliate / referral.
- i18n.
- Light-theme pixel polish (theme works but isn't pixel-perfect).
- Sentry / Datadog vendor wiring (logging shape is final; vendor hooks deferred).

---

## 23. Milestones — testable acceptance criteria

12 milestones, ~1–3 hrs each, ~30–40 hrs total.

### M1. Monorepo bootstrap
1. `pnpm install` from clean clone succeeds in < 90s.
2. `pnpm -F web dev` renders `/` placeholder with no console errors.
3. `pnpm typecheck`, `pnpm lint`, `pnpm test` all green (with smoke tests).
4. Husky pre-commit blocks a deliberately broken commit.
5. CI workflow green on a no-op PR.

### M2. Supabase + schema + seed
1. `supabase db push` applies all migrations cleanly twice (idempotent).
2. `pnpm tsx scripts/seed.ts` inserts 6 users, 120 properties, 120 markets, 80 comments without errors.
3. `supabase gen types` produces `lib/db/types.ts` with no `any`.
4. RLS verified: anon read on markets, blocked on accounts.
5. `engine_snapshots` and `notifications` tables exist with indexes.

### M3. Auth & onboarding
1. Sign-up form validates per zod schema with field-level errors.
2. Email verify link clickable in dev (Supabase magic link).
3. KYC wizard 3-step progresses with validation; "approved" state cached.
4. Logged-in user can see TopNav with avatar + balance pill.
5. Sign-out returns to `/` and clears React Query cache.

### M4. Markets feed
1. `/markets` shows seeded 120 MarketCards paginated 24/page.
2. Filters (zip, price, beds, sort) update URL search params + refetch.
3. Skeletons render < 200ms; real cards swap in without CLS.
4. Empty state shows for impossible filter combo.
5. Lighthouse perf ≥ 90 on `/markets`.

### M5. Market detail
1. `/markets/[slug]` renders header, PhotoGallery, PriceChart, OrderBookL2, TradePanel, CompsPanel, CommentsThread.
2. Each component has a skeleton; `loading.tsx` renders skeleton-only frame.
3. SEO metadata + JSON-LD present in HTML source.
4. 404 returns custom `not-found.tsx`.
5. Photo lightbox fully keyboard-navigable.

### M6. Go engine v1
1. `go test ./... -race` passes with ≥ 80% coverage in `book/` and `lmsr/`.
2. `cmd/engine` boots, connects to Postgres + NATS, exposes `/health`, `/ws`.
3. Snapshot every 5s observable in `engine_snapshots`.
4. WS subscribe → snapshot received < 200ms locally.
5. Graceful shutdown drains WS and writes final snapshot.

### M7. Trade panel + order placement
1. Order POSTs with `Idempotency-Key`; duplicate returns cached response.
2. Fee preview matches `calcFeeCents` exactly.
3. Insufficient-balance error renders inline + toast.
4. SlippageWarning triggers when best price moves > 2¢ between confirm-open and submit.
5. Server action validates with `orderSchema`.

### M8. Portfolio + activity
1. `/portfolio` lists positions with avg cost, mark price, P&L.
2. Activity feed paginates fills + journal entries.
3. CSV export downloads valid file with correct headers.
4. Realtime fill updates row without page reload.
5. Empty states render correctly for new account.

### M9. Orderbook + WS realtime
1. OrderBookL2 receives snapshot then deltas; sequence gaps trigger resnap.
2. Reconnect within 3s of network drop.
3. RecentTradesTable scrolls newest-on-top at 60fps.
4. Backpressure: client drops oldest non-essential frames > 1000 queued.
5. WS auth rejects expired JWT with `4401`.

### M10. Comments + watchlist + leaderboard
1. Comments posted via server action with rate limit.
2. Voting updates score optimistically; rolls back on failure.
3. Watchlist toggle persists + appears in `/watchlist`.
4. HoldersLeaderboard top-10 holders rendered with avatar + qty.
5. XSS attempt in comment body sanitized (DOMPurify on server).

### M11. LMSR house MM + mock oracle
1. House MM seeds initial liquidity at LMSR prices on market open.
2. Mock oracle settles market at scheduled `resolves_at`, writes `settlements` row + `notifications`.
3. Final-price banner + payout journal entries match expected math.
4. Voided path: settlement source missing → refund all locked funds.
5. Settlement event broadcast over WS `market_lifecycle`.

### M12. Settings, polish, smoke tests
1. Settings page edits display name, theme, notification prefs.
2. API key generate/rotate/revoke works (Phase 0 stub).
3. All 10 smoke flows pass in Playwright on CI.
4. Lighthouse desktop ≥ 90/95/100 on `/`, `/markets`, `/markets/[slug]`.
5. Zero `any`, zero `console.log`, zero ESLint warnings.

---

## 24. Code Style Examples

`apps/web/lib/fees.ts`:
```ts
export function calcFeeCents(priceCents: number, qty: number): number {
  if (priceCents < 1 || priceCents > 99) throw new Error("price out of range");
  if (qty <= 0) throw new Error("qty must be positive");
  const perShare = Math.round((0.07 * priceCents * (100 - priceCents)) / 100);
  return perShare * qty;
}
```

`apps/web/components/market-card.tsx`:
```tsx
"use client";
import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { cn } from "@/lib/cn";
import type { MarketCardProps } from "./market-card.types";

export function MarketCard(props: MarketCardProps) {
  const { slug, address, zip, thumbnailUrl, closesAt, topOutcome, volume24hCents, watching, variant = "default", onWatchToggle } = props;
  return (
    <Link
      href={`/markets/${slug}`}
      data-testid="market-card"
      className={cn(
        "group block rounded-xl border border-border bg-card transition",
        "hover:border-court-500/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-court-500",
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-t-xl">
        <Image src={thumbnailUrl} alt="" fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover" />
      </div>
      <div className="p-3">
        <div className="truncate text-base font-medium">{address}</div>
        <div className="text-xs text-muted-fg">{zip} · {formatClosesIn(closesAt)}</div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="font-mono text-2xl tabular-nums tracking-tight">{topOutcome.priceCents}¢</span>
          <DeltaChip pct={topOutcome.deltaPct} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-fg">
          <span>Vol {formatCoins(volume24hCents)}</span>
          <button
            type="button"
            aria-label={watching ? "Remove from watchlist" : "Add to watchlist"}
            onClick={(e) => { e.preventDefault(); onWatchToggle?.(slug); }}
            className="rounded-md p-1 hover:bg-muted"
          >
            <Heart className={cn("h-4 w-4", watching && "fill-court-500 text-court-500")} />
          </button>
        </div>
      </div>
    </Link>
  );
}
```

---

## 25. Sample Tests

### 25a. Vitest unit — `apps/web/lib/fees.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { calcFeeCents } from "./fees";

describe("calcFeeCents", () => {
  it("computes 7% of price*(100-price)/100 per share", () => {
    expect(calcFeeCents(50, 1)).toBe(Math.round(0.07 * 50 * 50 / 100));
    expect(calcFeeCents(55, 10)).toBe(Math.round(0.07 * 55 * 45 / 100) * 10);
  });
  it("rejects out-of-range prices", () => {
    expect(() => calcFeeCents(0, 1)).toThrow();
    expect(() => calcFeeCents(100, 1)).toThrow();
  });
  it("rejects non-positive qty", () => {
    expect(() => calcFeeCents(50, 0)).toThrow();
  });
});
```

### 25b. Playwright e2e — `apps/web/e2e/flow-1-onboard.spec.ts`

```ts
import { test, expect } from "@playwright/test";

test("Flow 1 — sign up, KYC, deposit, first trade", async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e+${stamp}@homecourt.test`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /trade the price/i })).toBeVisible();
  await page.getByRole("link", { name: /start trading free/i }).click();

  // Sign up
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/username/i).fill(`e2e${stamp}`.slice(0, 20));
  await page.getByLabel(/password/i).fill("Homecourt!2026");
  await page.getByLabel(/terms/i).check();
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByText(/welcome to homecourt/i)).toBeVisible();

  // KYC wizard (mock)
  await page.getByLabel(/legal first name/i).fill("E2E");
  await page.getByLabel(/legal last name/i).fill("Tester");
  await page.getByLabel(/date of birth/i).fill("2000-01-01");
  await page.getByLabel(/ssn/i).fill("1234");
  await page.getByLabel(/address line 1/i).fill("123 Oak St");
  await page.getByLabel(/city/i).fill("Austin");
  await page.getByLabel(/state/i).fill("TX");
  await page.getByLabel(/zip/i).fill("78704");
  await page.getByRole("button", { name: /submit kyc/i }).click();
  await expect(page.getByText(/kyc approved/i)).toBeVisible({ timeout: 8000 });

  // Deposit
  await page.getByRole("button", { name: /add coins/i }).click();
  await page.getByLabel(/amount/i).fill("50000");
  await page.getByRole("button", { name: /deposit/i }).click();
  await expect(page.getByText(/coins added/i)).toBeVisible();
  await expect(page.getByTestId("balance-pill")).toContainText("50,000");

  // Browse + trade
  await page.getByRole("link", { name: /markets/i }).click();
  await page.locator('[data-testid="market-card"]').first().click();
  await expect(page.getByTestId("orderbook-l2")).toBeVisible();
  await page.getByRole("button", { name: /buy/i }).first().click();
  await page.getByLabel(/price/i).fill("55");
  await page.getByLabel(/quantity/i).fill("10");
  await page.getByRole("button", { name: /place trade/i }).click();
  await page.getByRole("button", { name: /confirm/i }).click();
  await expect(page.getByText(/order placed/i)).toBeVisible();

  // Portfolio shows it
  await page.getByRole("link", { name: /portfolio/i }).click();
  await expect(page.getByRole("table")).toContainText("10");
});
```

`playwright.config.ts`: `webServer: { command: "pnpm dev", port: 3000, reuseExistingServer: !process.env.CI }`, `baseURL: "http://localhost:3000"`, projects `chromium` + `webkit`, retries 1, trace `on-first-retry`.

---

## 26. Environment Variables

`.env.example` (committed):
```
NEXT_PUBLIC_SUPABASE_URL=https://kdijttsbffilhezrxlds.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
ENGINE_URL=http://localhost:8080
ENGINE_WS_URL=ws://localhost:8080/ws
NATS_URL=nats://localhost:4222
NEXT_PUBLIC_BRAND=HOMECOURT
SWEEPSTAKES_STARTING_COINS=50000
NEXT_PUBLIC_RELEASE=dev
LOG_LEVEL=info
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
ORACLE_INTERVAL_MS=15000
```

Validated at boot via `lib/env.ts`:
```ts
import { z } from "zod";
const Env = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  ENGINE_URL: z.string().url(),
  ENGINE_WS_URL: z.string().startsWith("ws"),
  SWEEPSTAKES_STARTING_COINS: z.coerce.number().int().positive(),
});
export const env = Env.parse(process.env);
```

---

## 27. CI/CD

`.github/workflows/ci.yml`:
```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -F web typecheck
      - run: pnpm -F web lint
      - run: pnpm -F web test -- --run
      - run: pnpm -F web build
  engine:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: '1.22' }
      - working-directory: services/engine
        run: go vet ./... && go test ./... -race -count=1
  e2e:
    needs: [web]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -F web exec playwright install --with-deps chromium
      - run: pnpm -F web e2e
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.STAGING_ANON }}
```

Branch protection on `main`: require `web`, `engine`, `e2e` green + 1 review.

---

## 28. Final Check — 10-flow smoke test

Run all ten on a fresh deploy with seeded data. The build is complete when every box below is checked.

- [ ] **1. Onboard + first trade** — fresh email → signed-in homepage with balance pill in < 5 min.
- [ ] **2. Browse + filter** — apply ZIP `78704` + sort `closing` → URL params update + < 24 cards visible.
- [ ] **3. Deposit** — add 50,000 coins → BalancePill animates, journal row written.
- [ ] **4. Limit order** — place buy 55¢ × 10 → order appears in book, locked balance reflects.
- [ ] **5. Cancel** — cancel resting order → toast "Cancelled. Funds released.", balance restored.
- [ ] **6. Watchlist** — heart 3 markets → `/watchlist` shows exactly those 3.
- [ ] **7. Comp panel + comment** — open market → CompsPanel lists 3 comps → comment "Loving this market" posts.
- [ ] **8. Realtime orderbook** — open two browsers; place order in A → B's book updates < 500ms.
- [ ] **9. Mock oracle settlement** — fast-forward `resolves_at` → ResolutionCard shows final + journal credits.
- [ ] **10. CSV export** — `/portfolio/export.csv` downloads valid file matching on-screen fills.

**Build is complete when:** all 10 smoke flows pass on a fresh deploy, `pnpm typecheck && pnpm lint && pnpm test && pnpm e2e` is green from a clean clone, Lighthouse desktop hits ≥ 90 / 95 / 100 on `/`, `/markets`, and `/markets/[slug]`, and CI is green on `main`. If any flow fails, fix and re-run all 10 before declaring M12 complete.
