# HOMECOURT — UI/UX Master Prompt (Kalshi-faithful rebuild)

> Re-mastered from a frame-by-frame analysis of the Kalshi mobile app (9 reference
> screens: Explore, Market detail, Trade sheet ×3, Portfolio, Live, Search, Social).
> This is the binding spec for the **look and feel**. The product is HOMECOURT — a
> prediction market on whether a **real home sells above its list price**. Where
> Kalshi shows two teams, HOMECOURT shows one house with **YES / NO**.

## 0. North star

Build something that feels like Kalshi screenshot-for-screenshot: pure-black canvas,
one bold green and one bold red/pink, fat rounded pills, huge tabular numbers, and a
**numpad + Slide-to-Buy** trade flow. A first-time user taps a house, sees **YES 1.76x /
NO 2.33x**, taps a side, types a dollar amount, and slides to buy. No order book, no
jargon, no five buckets, **no cent prices**. The **payout multiplier** is the language:
every side shows `1.76x`. (% chance may appear only as the trade-sheet subtitle and the
chart axis; never a `57¢` price tag.)

Translation map (Kalshi → HOMECOURT):
- Two teams (NYK/CLE) → one binary outcome: **YES = sells above list**, **NO = at/below**.
- Team shoe thumbnail → the **listing's hero photo**.
- "Game 4: Knicks vs Cavaliers" → the **address** ("980 Brand Ln, Deerfield IL").
- "Today 7:00pm CDT" → **"Closes {date}"** (the market close, ~60 days out).
- Sports categories (Sports/Commodities/Politics) → **neighborhoods / price tiers / closing-soon**.

## 1. Design tokens

**Canvas:** true black `#0A0B0D` (cards `#121316`, raised `#16181C`). Not navy, not
charcoal — near-black like the screenshots.

**Accents (only two, used everywhere):**
- YES / up / brand: Kalshi green `#13DE9B` → `court-500`. Text-on-green is near-black.
- NO / down / sell: hot red-pink `#FF4D4D` → `no-500`. Text-on-red is white.
- Everything else is grayscale. Muted text `#8B919E`. Hairline borders `#22252B`.

**Type:** Inter (or a grotesk). Numbers are **mono, tabular, tight tracking**, always.
Prices/percentages are the loudest thing on every screen. Scale: hero number 56–72px
(trade amount), section H1 22–26px bold, card title 15–16px semibold, meta 11–13px muted.

**Shape:** pills are **fully rounded** (`rounded-full`) for buttons, toggles, chips,
and the slide track. Cards `rounded-2xl` (≈16px). Generous padding (16–20px). 4px grid.

**Bottom nav:** fixed, 5 tabs, icon + 11px label, active tab green, Portfolio shows the
live `$` balance as its label. The whole app is a centered `max-w-md` column on web.

## 2. Bottom tab bar (every screen)

`Explore · Live · Portfolio · Search · Social`. Icons: compass, radio/live-dot, wallet
(label = balance), magnifier, people. Active = `court-500`, inactive = muted. 64px tall,
hairline top border, black blurred background.

## 3. Explore (home)  — ref image 1

Top bar: menu (left), **HOMECOURT** wordmark (green), "Get 25" sweepstakes-coins pill
(amber), bell w/ unread badge (right).

**Category rail** (horizontal, scroll): `For You` (active) · `Closing Soon` · `Deerfield`
· `Under $500K` · `$1M+`. Active = white text + green underline/dot; rest muted.

**Featured carousel** (swipeable, peek next card): large `rounded-2xl` card with a faint
colored glow on one edge. Inside:
- Top row: category chip ("DEERFIELD · SINGLE FAMILY") left, "For sale" right.
- Hero photo (16:9) of the home.
- Address `980 Brand Ln` (bold) + `Deerfield, IL 60015 · 5bd · 3,749 sqft`.
- Two stat rows mirroring Kalshi's team rows:
  `YES — sells above $819K …………………… 1.76x`
  `NO  — sells at or below $819K ………… 2.33x`
  (label left with a thin colored underline, **payout multiplier right, big mono**).
- Footer: HOMECOURT mark + `$12,480 vol` left, `Closes Sep 30` right.
- Page dots under the carousel.

**Recent visits**: 2-up mini cards (address + YES/NO cents).
**Sections** by neighborhood / price tier (`Deerfield >`, `Under $500K >`), each a
horizontal rail of `MarketCard`s. Tapping a card → Market detail.

## 4. Market detail — ref image 2

Header: back, `…`, share, comment-count (green).
Sub-label `DEERFIELD · SINGLE FAMILY`. **Address as the H1** (`980 Brand Ln`).
Centered identity row: **hero photo** + `Closes Sep 30` + (optional) Zestimate.

**Price chart** (the centerpiece): two lines over time —
**YES (green)** and **NO (red)** — that sum to 100%, with big right-edge labels
`YES 57%` (green) / `NO 43%` (red). Below: `$12,480 vol` + timeframe pills
`1D 1W 1M ALL`. (Use `lightweight-charts`; seed from candlesticks, fall back to a flat
line at the implied price.)

**Two big pill buttons** (full-width, side by side):
`YES 1.76x` (green) · `NO 2.33x` (red). Tap → opens the **Trade sheet** pre-selected to
that side. (No order book, no multi-outcome table, no holders — those stay hidden.)

Below the fold: **About this home** (beds/baths/sqft/year, list price, list date, days on
market), **Comps** (3 nearest sold), **Comments**, **Resolution** ("Settles when the home
closes; YES pays if the recorded sale price exceeds the list price.").

## 5. Trade sheet (numpad + Slide-to-Buy) — ref images 3–5

Full-screen over black. This is the money screen — match it exactly.
- Top: `✕` (close) left, `Dollars ▾` pill right.
- Address (muted, small) + hero photo + the question (`Sells above $819K`).
- **YES | NO pill toggle**, centered, `max-w-[260px]`. YES active = green fill / near-black
  text; NO active = red fill / white text; inactive = muted.
- **Huge amount** centered: `$0` → `$150` as the user types (56–72px mono bold).
- One green line under it:
  - amount = 0 → `57% chance · 1.76x payout`
  - amount > 0 → `$264.39 payout if right` (and `Not enough balance` in red if over).
  - color = green for YES, red for NO.
- Divider: `$0.40 available`.
- **Numpad**: 1–9, `.`, 0, ⌫ — big, ample tap targets, subtle press state.
- **Slide to Buy**: pill track + circular green (YES) / red (NO) knob with a `→`. Drag past
  ~90% to confirm; keyboard Enter/Space also confirms; shows `Placing…` then closes.

Math: `chance% = price`, `multiplier = 100 / priceCents`, `contracts = floor(stake / price)`,
`payout = contracts × $1`. Submit a market buy of the chosen side.

## 6. Portfolio — ref image 6

Header: avatar + username, gear (settings).
`Portfolio` title, **balance huge** (`$50,000`), day P&L line below colored green/red.
Stat row: `Positions · Cash · Credit · Interest`. `+ Deposit` green pill.
Tabs: `OPEN · WATCHLIST · HISTORY` (+ sort icon). Empty: centered glyph + "No positions".
Position rows: hero thumb + address + `YES · sells above $819K`, qty, avg cost, live value
with ▲/▼ and % — mono, colored.

## 7. Live — ref image 7

Tabs with counts: `ALL 20 · CLOSING TODAY · NEW · HOT`.
Two big gradient category cards (e.g. `Deerfield SF` total vol, `Condos` total vol).
`Closing soon` header + each market as a Kalshi "live" row: hero thumb + address + a
`Closes 4d` chip + the YES/NO cent pills. Sort by soonest close.

## 8. Search — ref image 8

Search field ("Search address, ZIP, or neighborhood"). `Topics` grid (2-col outlined
pills w/ icons): Deerfield, Under $500K, $500K–$1M, $1M+, Closing soon, New, Condos,
Single-family. `Recently viewed` + `Trending` rails of `MarketCard`s.

## 9. Social — ref image 9

Tabs `FEED · FOLLOWING · LEADERBOARD` + time chips `Now · Today · This week · This month`.
Posts: avatar + handle + `Now` + `…`; body text; an embedded market/position card
(address + `YES · sells above $819K` + cost + live value ▲%); action row
(comment / like / share / save) + a `Buy` pill that opens the trade sheet. Green `+` FAB.

## 10. Component inventory (build/replace these)

`BottomNav`, `TopBar`, `CategoryRail`, `FeaturedCarousel`, `MarketCard` (multiplier pills),
`PriceChartYesNo` (two-line), `TradeButtons` (multiplier pills), `NumpadTradeSheet`,
`SlideToConfirm`, `YesNoToggle`, `PortfolioHeader`, `PositionRow`, `LiveRow`,
`TopicGrid`, `SocialPost`. All dark, pill-shaped, mono numbers, two-accent only.

## 11. Hard rules

- **Multipliers everywhere** (`1.76x`) on buttons/cards/pills — never cent prices (`57¢`)
  or dollar prices. (% chance may appear only in the trade-sheet subtitle and chart axis.)
- Only two accent colors (green/red); everything else grayscale on near-black.
- Numbers are mono + tabular + the loudest element.
- No order book, no five buckets, no "bet/odds/wager" vocabulary — use trade/contract/
  price/chance/payout/settle.
- Mobile-first, centered `max-w-md` column on web. Touch targets ≥ 44px.
- Real data only: markets come from the Deerfield Redfin scraper (`scripts/scrape-deerfield.ts`).
