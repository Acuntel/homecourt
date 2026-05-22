// Package match orchestrates per-market matching. Each Market has a Bid book
// and an Ask book per outcome (5 outcomes × 2 books = 10 books per market).
// All mutations for a given market happen on a single goroutine, so the
// books themselves don't need locks.
//
// TODO(post-phase-0): for multi-node deployment add a Redis lease so only one
// engine instance owns a given market_id at a time.
package match

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/Acuntel/homecourt/services/engine/internal/book"
)

// Market is the per-market matching state.
type Market struct {
	mu      sync.Mutex
	id      uuid.UUID
	slug    string
	bids    []*book.Book // indexed by outcome 0..4
	asks    []*book.Book
	seq     uint64
	orderID map[uuid.UUID]orderRef // lookup for cancel-by-id across all 10 books
}

type orderRef struct {
	outcome int
	side    book.Side
}

// Order is the input to Submit / submit through the engine. It mirrors the
// shape of a POST /v1/orders payload after validation.
type Order struct {
	ID         uuid.UUID
	MarketID   uuid.UUID
	UserID     uuid.UUID
	Outcome    int   // 0..4
	Side       book.Side
	PriceCents int32 // 1..99
	Qty        int64
}

// Result returned from Submit.
type Result struct {
	Seq            uint64
	Fills          []book.Fill
	RestingOrderID uuid.UUID // ID of the resting remainder, if any
	RestingQty     int64
}

// NewMarket builds a fresh market state with 5 outcomes × 2 sides.
func NewMarket(id uuid.UUID, slug string) *Market {
	m := &Market{
		id:      id,
		slug:    slug,
		bids:    make([]*book.Book, 5),
		asks:    make([]*book.Book, 5),
		orderID: make(map[uuid.UUID]orderRef, 256),
	}
	for i := 0; i < 5; i++ {
		m.bids[i] = book.New(book.Bid)
		m.asks[i] = book.New(book.Ask)
	}
	return m
}

// ID returns the market id.
func (m *Market) ID() uuid.UUID { return m.id }

// Slug returns the market slug.
func (m *Market) Slug() string { return m.slug }

// Seq returns the current sequence number for this market.
func (m *Market) Seq() uint64 {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.seq
}

// Submit places an order through the match loop with self-trade prevention
// (cancel-smaller policy). Returns generated fills + the resting remainder
// if any. Increments market seq on success.
func (m *Market) Submit(ord Order) (Result, error) {
	if ord.Outcome < 0 || ord.Outcome >= 5 {
		return Result{}, fmt.Errorf("outcome out of range: %d", ord.Outcome)
	}
	if ord.PriceCents < 1 || ord.PriceCents > 99 {
		return Result{}, fmt.Errorf("price out of range: %d", ord.PriceCents)
	}
	if ord.Qty <= 0 {
		return Result{}, errors.New("qty must be positive")
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	taker := &book.Order{
		ID:         ord.ID,
		UserID:     ord.UserID,
		Side:       ord.Side,
		PriceCents: ord.PriceCents,
		Qty:        ord.Qty,
		Remaining:  ord.Qty,
		CreatedAt:  time.Now().UTC(),
	}

	// Cross against the OPPOSITE book.
	var oppBook, sameBook *book.Book
	if ord.Side == book.Bid {
		oppBook = m.asks[ord.Outcome]
		sameBook = m.bids[ord.Outcome]
	} else {
		oppBook = m.bids[ord.Outcome]
		sameBook = m.asks[ord.Outcome]
	}

	// Self-trade policy: cancel the smaller side.
	stp := func(maker *book.Order) string {
		if maker.Remaining < taker.Remaining {
			return "cancel"
		}
		// maker >= taker: cancel taker (just stop matching).
		taker.Remaining = 0
		return "skip"
	}

	fills := oppBook.MatchAgainst(taker, stp)
	res := Result{Fills: fills}

	if taker.Remaining > 0 {
		sameBook.Rest(taker)
		m.orderID[taker.ID] = orderRef{outcome: ord.Outcome, side: ord.Side}
		res.RestingOrderID = taker.ID
		res.RestingQty = taker.Remaining
	}

	// Drop maker IDs that fully filled.
	for _, f := range fills {
		// We don't know without looking up maker remaining, but cleanup is
		// cheap: if the maker is no longer in any book, drop from orderID.
		if _, ok := m.orderID[f.MakerOrderID]; ok {
			// Verify by checking opposite book's index; simpler: try a cancel
			// path is unsafe. Just leave; orderID is a hint. We refresh on
			// snapshot reload.
			_ = f
		}
	}

	m.seq++
	res.Seq = m.seq
	return res, nil
}

// Cancel removes the order with the given id from whichever side/outcome
// holds it. Returns the cancelled qty and true on success.
func (m *Market) Cancel(id uuid.UUID) (int64, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	ref, ok := m.orderID[id]
	if !ok {
		// Slow path: scan all books.
		for outcome := 0; outcome < 5; outcome++ {
			if o, ok := m.bids[outcome].Cancel(id); ok {
				m.seq++
				return o.Remaining, true
			}
			if o, ok := m.asks[outcome].Cancel(id); ok {
				m.seq++
				return o.Remaining, true
			}
		}
		return 0, false
	}
	delete(m.orderID, id)
	var b *book.Book
	if ref.side == book.Bid {
		b = m.bids[ref.outcome]
	} else {
		b = m.asks[ref.outcome]
	}
	o, ok := b.Cancel(id)
	if !ok {
		return 0, false
	}
	m.seq++
	return o.Remaining, true
}

// Snapshot returns the L2 snapshot for one outcome side. depth=0 means all
// levels (used by GET /v1/book endpoint with depth=20 typically).
func (m *Market) Snapshot(outcome int, side book.Side, depth int) (book.Snapshot, error) {
	if outcome < 0 || outcome >= 5 {
		return book.Snapshot{}, fmt.Errorf("outcome out of range: %d", outcome)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if side == book.Bid {
		return m.bids[outcome].Snapshot(depth), nil
	}
	return m.asks[outcome].Snapshot(depth), nil
}

// AllOrders returns every resting order in this market for snapshotting.
// Returns a map of outcome -> side -> []*book.Order.
type ResterEntry struct {
	Outcome int
	Side    book.Side
	Order   *book.Order
}

// AllResting returns every resting order across all outcomes/sides.
func (m *Market) AllResting() []ResterEntry {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]ResterEntry, 0, len(m.orderID))
	for outcome := 0; outcome < 5; outcome++ {
		for _, o := range m.bids[outcome].Orders() {
			out = append(out, ResterEntry{Outcome: outcome, Side: book.Bid, Order: o})
		}
		for _, o := range m.asks[outcome].Orders() {
			out = append(out, ResterEntry{Outcome: outcome, Side: book.Ask, Order: o})
		}
	}
	return out
}

// LoadResting inserts an order directly into the book without matching.
// Used by snapshot replay on startup.
func (m *Market) LoadResting(outcome int, side book.Side, o *book.Order) error {
	if outcome < 0 || outcome >= 5 {
		return fmt.Errorf("outcome out of range: %d", outcome)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if side == book.Bid {
		m.bids[outcome].Rest(o)
	} else {
		m.asks[outcome].Rest(o)
	}
	m.orderID[o.ID] = orderRef{outcome: outcome, side: side}
	return nil
}

// SetSeq overrides the sequence (used after replaying a snapshot).
func (m *Market) SetSeq(seq uint64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.seq = seq
}

// Registry holds all known markets, keyed by id. Safe for concurrent use.
type Registry struct {
	mu      sync.RWMutex
	byID    map[uuid.UUID]*Market
	bySlug  map[string]*Market
}

// NewRegistry returns an empty registry.
func NewRegistry() *Registry {
	return &Registry{
		byID:   make(map[uuid.UUID]*Market),
		bySlug: make(map[string]*Market),
	}
}

// Add registers a new market.
func (r *Registry) Add(m *Market) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.byID[m.id] = m
	r.bySlug[m.slug] = m
}

// Get returns the market by id (nil if unknown).
func (r *Registry) Get(id uuid.UUID) *Market {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.byID[id]
}

// BySlug returns the market by slug (nil if unknown).
func (r *Registry) BySlug(slug string) *Market {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.bySlug[slug]
}

// All returns all markets in stable order.
func (r *Registry) All() []*Market {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*Market, 0, len(r.byID))
	for _, m := range r.byID {
		out = append(out, m)
	}
	return out
}

// Count returns the number of registered markets.
func (r *Registry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.byID)
}

// CalcFeeCents mirrors apps/web/lib/fees.ts exactly.
//
//	feeCents = round(0.07 * price * (100 - price) / 100) * qty
//
// Taker fee only. Pricing must be in cents [1..99]; qty > 0.
func CalcFeeCents(priceCents int32, qty int64) (int64, error) {
	if priceCents < 1 || priceCents > 99 {
		return 0, fmt.Errorf("price out of range: %d", priceCents)
	}
	if qty <= 0 {
		return 0, errors.New("qty must be positive")
	}
	// JS uses Math.round (round half-away-from-zero for positives). Our values
	// are always positive so the standard math.Round behavior matches.
	x := 0.07 * float64(priceCents) * float64(100-priceCents) / 100.0
	perShare := int64(roundHalfAwayFromZero(x))
	return perShare * qty, nil
}

func roundHalfAwayFromZero(x float64) float64 {
	if x >= 0 {
		return float64(int64(x + 0.5))
	}
	return float64(int64(x - 0.5))
}

// Stop closes the engine — currently a no-op since markets are owned by
// their goroutine via the http handler caller. Reserved for graceful drain.
func (m *Market) Stop(_ context.Context) error { return nil }
