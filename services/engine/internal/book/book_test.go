package book_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/Acuntel/homecourt/services/engine/internal/book"
)

func mkOrder(t *testing.T, side book.Side, price int32, qty int64) *book.Order {
	t.Helper()
	return &book.Order{
		ID:         uuid.New(),
		UserID:     uuid.New(),
		Side:       side,
		PriceCents: price,
		Qty:        qty,
		Remaining:  qty,
		CreatedAt:  time.Now(),
	}
}

// 1. Insert + snapshot sees the order at the right level.
func TestBookInsertAndSnapshot(t *testing.T) {
	b := book.New(book.Bid)
	o := mkOrder(t, book.Bid, 47, 100)
	b.Rest(o)

	require.Equal(t, 1, b.Len())
	snap := b.Snapshot(10)
	require.Len(t, snap.Levels, 1)
	require.Equal(t, int64(47), snap.Levels[0][0])
	require.Equal(t, int64(100), snap.Levels[0][1])

	// Best price exposed.
	p, q, ok := b.Best()
	require.True(t, ok)
	require.Equal(t, int32(47), p)
	require.Equal(t, int64(100), q)
}

// 2. Cancel removes the order, free level.
func TestBookCancel(t *testing.T) {
	b := book.New(book.Ask)
	o1 := mkOrder(t, book.Ask, 53, 100)
	o2 := mkOrder(t, book.Ask, 53, 50)
	b.Rest(o1)
	b.Rest(o2)
	require.Equal(t, 2, b.Len())

	got, ok := b.Cancel(o1.ID)
	require.True(t, ok)
	require.Equal(t, o1.ID, got.ID)
	require.Equal(t, 1, b.Len())

	// Cancel the second too — level should disappear.
	_, ok = b.Cancel(o2.ID)
	require.True(t, ok)
	require.Equal(t, 0, b.Len())
	snap := b.Snapshot(0)
	require.Empty(t, snap.Levels)

	// Cancelling an unknown id is a no-op.
	_, ok = b.Cancel(uuid.New())
	require.False(t, ok)
}

// 3. Price-time priority: orders at same price match FIFO.
func TestBookFIFOAtSamePrice(t *testing.T) {
	asks := book.New(book.Ask)
	mk1 := mkOrder(t, book.Ask, 50, 30) // arrived first
	mk2 := mkOrder(t, book.Ask, 50, 30) // arrived second
	asks.Rest(mk1)
	asks.Rest(mk2)

	taker := mkOrder(t, book.Bid, 60, 40) // crosses both, fills 30 + 10
	fills := asks.MatchAgainst(taker, nil)
	require.Len(t, fills, 2)
	require.Equal(t, mk1.ID, fills[0].MakerOrderID)
	require.Equal(t, int64(30), fills[0].Qty)
	require.Equal(t, mk2.ID, fills[1].MakerOrderID)
	require.Equal(t, int64(10), fills[1].Qty)
	require.Equal(t, int64(0), taker.Remaining)

	// mk2 has 20 left.
	snap := asks.Snapshot(10)
	require.Len(t, snap.Levels, 1)
	require.Equal(t, int64(20), snap.Levels[0][1])
}

// 4. Better-price levels cross first.
func TestBookBetterPriceFirst(t *testing.T) {
	asks := book.New(book.Ask)
	asks.Rest(mkOrder(t, book.Ask, 55, 10)) // worse
	asks.Rest(mkOrder(t, book.Ask, 50, 10)) // best
	asks.Rest(mkOrder(t, book.Ask, 52, 10)) // middle

	taker := mkOrder(t, book.Bid, 99, 25)
	fills := asks.MatchAgainst(taker, nil)
	require.Len(t, fills, 3)
	require.Equal(t, int32(50), fills[0].PriceCents)
	require.Equal(t, int32(52), fills[1].PriceCents)
	require.Equal(t, int32(55), fills[2].PriceCents)
	require.Equal(t, int64(0), taker.Remaining)
}

// 5. Non-crossing order does NOT match.
func TestBookNoCross(t *testing.T) {
	asks := book.New(book.Ask)
	asks.Rest(mkOrder(t, book.Ask, 60, 10))
	taker := mkOrder(t, book.Bid, 59, 5)
	fills := asks.MatchAgainst(taker, nil)
	require.Empty(t, fills)
	require.Equal(t, int64(5), taker.Remaining)
}
