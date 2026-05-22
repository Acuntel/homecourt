// Package book implements a price-time priority limit order book for a single
// (market, outcome, side) tuple. Bids and asks live in separate Book instances
// (see BUILD.md §10 — "Use (a) separate books per side").
//
// Concurrency: a Book is NOT safe for concurrent mutation. The matching
// engine guarantees single-writer access by routing every command for a given
// market through a dedicated goroutine (see internal/match).
package book

import (
	"sort"
	"time"

	"github.com/google/uuid"
)

// Side is the side of the book that a resting order sits on. Note this is
// the *book* side, not the order direction:
//   - YES Bid (buy YES at price P)  -> resides on Bid book for outcome i.
//   - YES Ask (sell YES at price P) -> resides on Ask book for outcome i.
type Side int8

const (
	Bid Side = 0
	Ask Side = 1
)

func (s Side) String() string {
	if s == Bid {
		return "bid"
	}
	return "ask"
}

// Order is a single resting (or about-to-rest) limit order within a book.
type Order struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	Side       Side
	PriceCents int32 // 1..99
	Qty        int64 // original size
	Remaining  int64 // unfilled portion (decreases on match/cancel)
	CreatedAt  time.Time
}

// Fill is a single match between a taker and a resting maker order.
type Fill struct {
	TakerOrderID uuid.UUID
	MakerOrderID uuid.UUID
	TakerUserID  uuid.UUID
	MakerUserID  uuid.UUID
	PriceCents   int32
	Qty          int64
	Ts           time.Time
}

// Level is one price level in the book — orders queued FIFO.
type Level struct {
	Price  int32
	Orders []*Order // FIFO: oldest at index 0
	Total  int64    // sum of Remaining across Orders (kept in sync)
}

// Snapshot is an L2 view of the book: aggregated qty per price level.
type Snapshot struct {
	Side    Side
	Levels  [][2]int64 // [priceCents, qty], sorted best-first
	OrderCt int
}

// Book is one side of a (market, outcome) order book.
type Book struct {
	side    Side
	levels  []*Level             // bids: desc by price; asks: asc by price
	byPrice map[int32]*Level     // O(1) price -> level
	byID    map[uuid.UUID]*Order // O(1) cancel by order id
}

// New returns an empty book for the given side.
func New(s Side) *Book {
	return &Book{
		side:    s,
		levels:  nil,
		byPrice: make(map[int32]*Level),
		byID:    make(map[uuid.UUID]*Order),
	}
}

// Side returns the side this book represents.
func (b *Book) Side() Side { return b.side }

// Rest inserts an order with no matching attempt (used by snapshot reload).
// Callers placing fresh orders should use the matching engine in
// internal/match which calls Match + Rest as appropriate.
func (b *Book) Rest(o *Order) {
	if o.Remaining <= 0 {
		return
	}
	lvl, ok := b.byPrice[o.PriceCents]
	if !ok {
		lvl = &Level{Price: o.PriceCents}
		b.byPrice[o.PriceCents] = lvl
		b.insertLevel(lvl)
	}
	lvl.Orders = append(lvl.Orders, o)
	lvl.Total += o.Remaining
	b.byID[o.ID] = o
}

// Cancel removes the order with the given id. Returns the cancelled order
// (with .Remaining at time of cancel) and true if it was resting; otherwise
// returns nil/false.
func (b *Book) Cancel(id uuid.UUID) (*Order, bool) {
	o, ok := b.byID[id]
	if !ok {
		return nil, false
	}
	lvl := b.byPrice[o.PriceCents]
	if lvl == nil {
		// shouldn't happen if invariants held — defensive cleanup.
		delete(b.byID, id)
		return o, true
	}
	for i, q := range lvl.Orders {
		if q.ID == id {
			lvl.Orders = append(lvl.Orders[:i], lvl.Orders[i+1:]...)
			lvl.Total -= q.Remaining
			break
		}
	}
	delete(b.byID, id)
	if len(lvl.Orders) == 0 {
		b.removeLevel(o.PriceCents)
	}
	return o, true
}

// Best returns the best (price, qty) on this book and true; or 0,0,false
// if the book is empty.
func (b *Book) Best() (priceCents int32, qty int64, ok bool) {
	if len(b.levels) == 0 {
		return 0, 0, false
	}
	l := b.levels[0]
	return l.Price, l.Total, true
}

// Snapshot returns the top `depth` price levels, aggregated. Best level
// first. If depth <= 0, returns all levels.
func (b *Book) Snapshot(depth int) Snapshot {
	n := len(b.levels)
	if depth > 0 && depth < n {
		n = depth
	}
	out := Snapshot{Side: b.side, Levels: make([][2]int64, 0, n)}
	count := 0
	for i := 0; i < n; i++ {
		l := b.levels[i]
		out.Levels = append(out.Levels, [2]int64{int64(l.Price), l.Total})
		count += len(l.Orders)
	}
	out.OrderCt = count
	return out
}

// Orders returns a flat list of every resting order, oldest-first per level,
// best price first. Used for snapshotting to Postgres.
func (b *Book) Orders() []*Order {
	out := make([]*Order, 0, len(b.byID))
	for _, l := range b.levels {
		out = append(out, l.Orders...)
	}
	return out
}

// Len reports the number of resting orders.
func (b *Book) Len() int { return len(b.byID) }

// MatchAgainst attempts to match the incoming taker order against this book.
// The caller passes a taker whose Side is the OPPOSITE of this book's side
// (e.g. an incoming buy crosses the Ask book). Returns generated fills and
// mutates `taker.Remaining` plus this book's resting orders.
//
// selfTrade is invoked when taker.UserID == maker.UserID and may return:
//   - "skip":   skip this maker (continue looking)
//   - "cancel": cancel the maker (don't match) — caller is responsible for
//     persistence/WAL of the cancel
//
// Default policy: cancel-smaller (handled in internal/match).
func (b *Book) MatchAgainst(taker *Order, selfTrade func(maker *Order) string) []Fill {
	var fills []Fill
	for taker.Remaining > 0 && len(b.levels) > 0 {
		best := b.levels[0]
		if !priceCrosses(taker.Side, taker.PriceCents, best.Price) {
			break
		}
		// Iterate FIFO at this level.
		i := 0
		for i < len(best.Orders) && taker.Remaining > 0 {
			maker := best.Orders[i]
			if maker.UserID == taker.UserID && selfTrade != nil {
				switch selfTrade(maker) {
				case "skip":
					i++
					continue
				case "cancel":
					// remove maker from book, continue at same i.
					best.Orders = append(best.Orders[:i], best.Orders[i+1:]...)
					best.Total -= maker.Remaining
					delete(b.byID, maker.ID)
					maker.Remaining = 0
					continue
				}
			}
			qty := taker.Remaining
			if maker.Remaining < qty {
				qty = maker.Remaining
			}
			fills = append(fills, Fill{
				TakerOrderID: taker.ID,
				MakerOrderID: maker.ID,
				TakerUserID:  taker.UserID,
				MakerUserID:  maker.UserID,
				PriceCents:   best.Price, // maker price (price improvement to taker)
				Qty:          qty,
				Ts:           time.Now().UTC(),
			})
			taker.Remaining -= qty
			maker.Remaining -= qty
			best.Total -= qty
			if maker.Remaining == 0 {
				best.Orders = append(best.Orders[:i], best.Orders[i+1:]...)
				delete(b.byID, maker.ID)
			} else {
				i++
			}
		}
		if len(best.Orders) == 0 {
			b.removeLevel(best.Price)
		}
	}
	return fills
}

func priceCrosses(takerSide Side, takerPrice, makerPrice int32) bool {
	// Taker is OPPOSITE of book side. If book is Ask, taker is Bid (buyer):
	//   buyer crosses when takerPrice >= ask.
	// If book is Bid, taker is Ask (seller): seller crosses when takerPrice <= bid.
	if takerSide == Bid {
		// crossing Ask book
		return takerPrice >= makerPrice
	}
	return takerPrice <= makerPrice
}

// insertLevel inserts l into b.levels keeping sort invariant.
func (b *Book) insertLevel(l *Level) {
	// bids desc, asks asc.
	idx := sort.Search(len(b.levels), func(i int) bool {
		if b.side == Bid {
			return b.levels[i].Price < l.Price
		}
		return b.levels[i].Price > l.Price
	})
	b.levels = append(b.levels, nil)
	copy(b.levels[idx+1:], b.levels[idx:])
	b.levels[idx] = l
}

func (b *Book) removeLevel(price int32) {
	for i, l := range b.levels {
		if l.Price == price {
			b.levels = append(b.levels[:i], b.levels[i+1:]...)
			break
		}
	}
	delete(b.byPrice, price)
}
