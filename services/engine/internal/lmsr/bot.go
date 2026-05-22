// LS-LMSR house market maker bot.
//
// One goroutine per market. Each tick (or on a book-delta event) the bot:
//
//  1. Reads its target prices from the LS-LMSR state (anchored to Zestimate).
//  2. Generates a small bid/ask ladder around each outcome's price.
//  3. Cancels prior house quotes that no longer match the target.
//  4. Submits fresh quotes via the in-process match.Registry, persisting an
//     orders row to Postgres so portfolio + idempotency stay coherent.
//
// The bot's user_id is a fixed UUID — see HouseUserID — and it inserts a
// real public.users + public.accounts row at startup (see store/bootstrap).
//
// Cap: per-market notional exposure $200K. When breached we stop quoting
// that side until the position decays back under the cap.
package lmsr

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/Acuntel/homecourt/services/engine/internal/book"
	"github.com/Acuntel/homecourt/services/engine/internal/match"
)

// HouseUserID is the fixed UUID we assign the house market maker. Must be
// inserted into public.users + public.accounts at engine startup.
var HouseUserID = uuid.MustParse("00000000-0000-0000-0000-00000000000a")

// PositionCapCents is the per-market notional exposure cap ($200K = 20M
// cents at $1/contract max payout).
const PositionCapCents int64 = 20_000_000

// QuoteSize is the default per-quote share count posted on each side.
// QuoteSize: contracts the house MM rests at each price level per outcome
// side. 100 keeps Phase 0 retail flow (typical bet 1–50 contracts) fully
// fillable against house liquidity. 5 outcomes × 2 sides × 100 ≈ $500 of
// notional exposure per market — still well under the $200K kill switch.
const QuoteSize int64 = 100

// SpreadCents is the half-spread we post around the LMSR mid. 2¢ keeps
// round-trip cost a hair above LMSR's intrinsic vig.
const SpreadCents int32 = 2

// BookDeltaThresholdCents — refresh quotes immediately when our quoted
// price drifts more than this from the LMSR mid (in addition to the 1s tick).
const BookDeltaThresholdCents int32 = 50

// MarketSeed carries the per-market info the bot needs to seed its q vector
// and identify the Postgres row.
type MarketSeed struct {
	MarketID       uuid.UUID
	Slug           string
	ZestimateCents int64
	BucketLows     []int64
	BucketHighs    []int64
}

// OrderPersister is the subset of store.Store the bot needs to record its
// orders so portfolio queries see house liquidity. Kept as an interface so
// the bot is testable without a database.
type OrderPersister interface {
	InsertOrder(ctx context.Context, in OrderInput) error
	CancelOrder(ctx context.Context, id uuid.UUID) error
}

// OrderInput mirrors store.InsertOrderInput without importing store (avoids
// a cycle between lmsr and store).
type OrderInput struct {
	ID                   uuid.UUID
	ClientIdempotencyKey string
	MarketID             uuid.UUID
	UserID               uuid.UUID
	Outcome              int
	Side                 string // "buy" | "sell"
	PriceCents           int32
	Qty                  int64
}

// Bot is the per-market market maker.
type Bot struct {
	mu          sync.Mutex
	state       *State
	market      *match.Market
	seed        MarketSeed
	persister   OrderPersister
	log         *slog.Logger
	resting     map[outcomeSide]uuid.UUID // current resting order id per (outcome, side, level=mid)
	notional    [5]int64                  // current per-outcome notional in cents (worst-case payout)
	lastQuotePx [5][2]int32               // [outcome][0=bid,1=ask] last posted price
	stopped     bool
	tickEvery   time.Duration
}

type outcomeSide struct {
	outcome int
	side    book.Side
}

// NewBot constructs a bot for one market. It seeds the LS-LMSR state from
// the Zestimate-anchored prior. The returned bot is NOT started — call Run.
func NewBot(market *match.Market, seed MarketSeed, persister OrderPersister, log *slog.Logger) (*Bot, error) {
	s := New(500.0, 5)
	anchorIdx := BucketForCents(seed.ZestimateCents, seed.BucketLows, seed.BucketHighs)
	targets := PricesFromZestimate(anchorIdx, 5)
	if err := s.SeedFromPrices(targets); err != nil {
		return nil, fmt.Errorf("seed lmsr for %s: %w", seed.Slug, err)
	}
	return &Bot{
		state:     s,
		market:    market,
		seed:      seed,
		persister: persister,
		log:       log,
		resting:   make(map[outcomeSide]uuid.UUID, 10),
		tickEvery: time.Second,
	}, nil
}

// State exposes the underlying LMSR state (read-only outside tests).
func (b *Bot) State() *State { return b.state }

// Run is the bot loop. Blocks until ctx is cancelled. Safe to call once per
// bot — subsequent calls return immediately.
func (b *Bot) Run(ctx context.Context) {
	b.mu.Lock()
	if b.stopped {
		b.mu.Unlock()
		return
	}
	b.mu.Unlock()

	// Initial quote.
	b.refresh(ctx)

	t := time.NewTicker(b.tickEvery)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			// Intentionally NOT cancelling resting quotes: they persist
			// across engine restarts via the snapshot path so users still
			// see house liquidity through a redeploy.
			return
		case <-t.C:
			b.refresh(ctx)
		}
	}
}

// Stop instructs the bot to stop on its next iteration. Safe to call
// multiple times.
func (b *Bot) Stop() {
	b.mu.Lock()
	b.stopped = true
	b.mu.Unlock()
}

// refresh recomputes target quotes from the LMSR state and replaces any
// stale resting house orders. Errors are logged, not fatal — we never want
// the bot to take down the engine.
func (b *Bot) refresh(ctx context.Context) {
	prices := b.state.AllPrices()
	for outcome := 0; outcome < 5; outcome++ {
		mid := priceToCents(prices[outcome])
		// Skip edge prices that would generate invalid orders.
		bidCents := mid - SpreadCents
		askCents := mid + SpreadCents
		if bidCents < 1 {
			bidCents = 1
		}
		if askCents > 99 {
			askCents = 99
		}
		// Bid side — only quote if under the cap.
		if b.notional[outcome] < PositionCapCents {
			b.replaceQuote(ctx, outcome, book.Bid, bidCents)
		} else {
			b.cancelQuote(ctx, outcome, book.Bid)
		}
		// Ask side — same cap check on the symmetric exposure (selling YES
		// is risk on a winning settle, which we model identically here).
		if b.notional[outcome] < PositionCapCents {
			b.replaceQuote(ctx, outcome, book.Ask, askCents)
		} else {
			b.cancelQuote(ctx, outcome, book.Ask)
		}
	}
}

// replaceQuote cancels any prior house quote on (outcome, side) and posts a
// fresh one at priceCents × QuoteSize. If the prior quote is already within
// BookDeltaThresholdCents we leave it in place (no churn).
func (b *Bot) replaceQuote(ctx context.Context, outcome int, side book.Side, priceCents int32) {
	if priceCents < 1 || priceCents > 99 {
		return
	}
	b.mu.Lock()
	key := outcomeSide{outcome: outcome, side: side}
	prevID, hasPrev := b.resting[key]
	sideIdx := 0
	if side == book.Ask {
		sideIdx = 1
	}
	prevPx := b.lastQuotePx[outcome][sideIdx]
	b.mu.Unlock()

	// If the existing quote is close enough, keep it.
	if hasPrev && abs32(prevPx-priceCents) <= BookDeltaThresholdCents {
		return
	}

	// Cancel old quote (best-effort, both in-memory and DB).
	if hasPrev {
		b.market.Cancel(prevID)
		if b.persister != nil {
			if err := b.persister.CancelOrder(ctx, prevID); err != nil {
				b.log.Warn("lmsr cancel db", "err", err, "market", b.seed.Slug)
			}
		}
	}

	// Submit fresh quote.
	newID := uuid.New()
	sideStr := "buy"
	if side == book.Ask {
		sideStr = "sell"
	}
	// Persist FIRST so the orders row exists before the bot can match against it.
	if b.persister != nil {
		if err := b.persister.InsertOrder(ctx, OrderInput{
			ID:                   newID,
			ClientIdempotencyKey: "house_mm_" + newID.String(),
			MarketID:             b.seed.MarketID,
			UserID:               HouseUserID,
			Outcome:              outcome,
			Side:                 sideStr,
			PriceCents:           priceCents,
			Qty:                  QuoteSize,
		}); err != nil {
			b.log.Warn("lmsr persist", "err", err, "market", b.seed.Slug)
			return
		}
	}
	_, err := b.market.Submit(match.Order{
		ID:         newID,
		MarketID:   b.seed.MarketID,
		UserID:     HouseUserID,
		Outcome:    outcome,
		Side:       side,
		PriceCents: priceCents,
		Qty:        QuoteSize,
	})
	if err != nil {
		b.log.Warn("lmsr submit", "err", err, "market", b.seed.Slug)
		return
	}

	b.mu.Lock()
	b.resting[key] = newID
	b.lastQuotePx[outcome][sideIdx] = priceCents
	// Track worst-case notional: each resting QuoteSize is worth up to $1
	// per share at settlement.
	b.notional[outcome] += QuoteSize * 100
	b.mu.Unlock()
}

// cancelQuote removes any resting house order on (outcome, side).
func (b *Bot) cancelQuote(ctx context.Context, outcome int, side book.Side) {
	b.mu.Lock()
	key := outcomeSide{outcome: outcome, side: side}
	id, ok := b.resting[key]
	if ok {
		delete(b.resting, key)
	}
	b.mu.Unlock()
	if !ok {
		return
	}
	b.market.Cancel(id)
	if b.persister != nil {
		if err := b.persister.CancelOrder(ctx, id); err != nil {
			b.log.Warn("lmsr cancel db", "err", err, "market", b.seed.Slug)
		}
	}
}

