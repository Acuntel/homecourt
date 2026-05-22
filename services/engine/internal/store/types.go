// Package store contains schema-mirror types and Postgres persistence helpers.
//
// Types here are hand-mirrored from BUILD.md §4 (Database Schema). No
// generator (sqlc/ent) is used — every change to the SQL schema requires a
// matching change here. Money is always int64 cents.
package store

import (
	"time"

	"github.com/google/uuid"
)

// OrderSide mirrors `order_side` enum in supabase/migrations/0004.
type OrderSide string

const (
	SideBuy  OrderSide = "buy"
	SideSell OrderSide = "sell"
)

// OrderStatus mirrors `order_status` enum.
type OrderStatus string

const (
	StatusOpen      OrderStatus = "open"
	StatusPartial   OrderStatus = "partial"
	StatusFilled    OrderStatus = "filled"
	StatusCancelled OrderStatus = "cancelled"
	StatusExpired   OrderStatus = "expired"
)

// JournalKind mirrors `journal_kind` enum.
type JournalKind string

const (
	JournalDeposit       JournalKind = "deposit"
	JournalWithdraw      JournalKind = "withdraw"
	JournalOrderLock     JournalKind = "order_lock"
	JournalOrderRelease  JournalKind = "order_release"
	JournalFillDebit     JournalKind = "fill_debit"
	JournalFillCredit    JournalKind = "fill_credit"
	JournalFee           JournalKind = "fee"
	JournalSettlement    JournalKind = "settlement"
	JournalAdjustment    JournalKind = "adjustment"
)

// MarketState mirrors `market_state` enum.
type MarketState string

const (
	MarketUpcoming MarketState = "upcoming"
	MarketOpen     MarketState = "open"
	MarketClosing  MarketState = "closing"
	MarketSettled  MarketState = "settled"
	MarketVoided   MarketState = "voided"
)

// Market mirrors public.markets (subset the engine needs at boot).
type Market struct {
	ID         uuid.UUID
	Slug       string
	PropertyID uuid.UUID
	Buckets    []Bucket
	OpensAt    time.Time
	ClosesAt   time.Time
	ResolvesAt time.Time
	State      MarketState
}

// Bucket is one of the 5 outcome ranges on a binary_range_5 market.
type Bucket struct {
	Label     string `json:"label"`
	LowCents  int64  `json:"low_cents"`
	HighCents int64  `json:"high_cents"`
}

// Order is the engine-domain view of public.orders. We don't store
// idempotency keys here — those live only in the idempotency_keys table.
type Order struct {
	ID         uuid.UUID
	MarketID   uuid.UUID
	UserID     uuid.UUID
	Outcome    int
	Side       OrderSide
	PriceCents int32 // 1..99
	Qty        int64
	FilledQty  int64
	Status     OrderStatus
	CreatedAt  time.Time
}

// Fill is the engine-domain view of public.fills.
type Fill struct {
	ID           uuid.UUID
	MarketID     uuid.UUID
	TakerOrderID uuid.UUID
	MakerOrderID uuid.UUID
	Outcome      int
	PriceCents   int32
	Qty          int64
	FeeCents     int64
	CreatedAt    time.Time
}
