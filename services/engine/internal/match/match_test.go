package match_test

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/Acuntel/homecourt/services/engine/internal/book"
	"github.com/Acuntel/homecourt/services/engine/internal/match"
)

// 1. Full match between two opposing orders at the same price → fill.
func TestMatchOpposingOrders(t *testing.T) {
	m := match.NewMarket(uuid.New(), "test-market")
	alice := uuid.New()
	bob := uuid.New()

	res, err := m.Submit(match.Order{
		ID: uuid.New(), MarketID: m.ID(), UserID: alice,
		Outcome: 0, Side: book.Ask, PriceCents: 47, Qty: 10,
	})
	require.NoError(t, err)
	require.Empty(t, res.Fills)
	require.Equal(t, int64(10), res.RestingQty)

	res, err = m.Submit(match.Order{
		ID: uuid.New(), MarketID: m.ID(), UserID: bob,
		Outcome: 0, Side: book.Bid, PriceCents: 47, Qty: 10,
	})
	require.NoError(t, err)
	require.Len(t, res.Fills, 1)
	require.Equal(t, int32(47), res.Fills[0].PriceCents)
	require.Equal(t, int64(10), res.Fills[0].Qty)
	require.Equal(t, alice, res.Fills[0].MakerUserID)
	require.Equal(t, bob, res.Fills[0].TakerUserID)
	require.Equal(t, int64(0), res.RestingQty)
}

// 2. Self-trade prevention — cancel smaller side.
func TestSelfTradePrevention(t *testing.T) {
	m := match.NewMarket(uuid.New(), "stp-market")
	alice := uuid.New()

	// Alice rests an ask at 47 × 20.
	_, err := m.Submit(match.Order{
		ID: uuid.New(), MarketID: m.ID(), UserID: alice,
		Outcome: 0, Side: book.Ask, PriceCents: 47, Qty: 20,
	})
	require.NoError(t, err)

	// Alice's own buy of 5 should NOT match her own ask — taker is smaller so taker cancels.
	res, err := m.Submit(match.Order{
		ID: uuid.New(), MarketID: m.ID(), UserID: alice,
		Outcome: 0, Side: book.Bid, PriceCents: 47, Qty: 5,
	})
	require.NoError(t, err)
	require.Empty(t, res.Fills)
	require.Equal(t, int64(0), res.RestingQty) // small side cancelled

	// Snapshot still shows the original 20-share ask.
	snap, _ := m.Snapshot(0, book.Ask, 10)
	require.Len(t, snap.Levels, 1)
	require.Equal(t, int64(20), snap.Levels[0][1])
}

// 3. Self-trade prevention — cancel maker when taker is bigger.
func TestSelfTradeCancelsMakerWhenBigger(t *testing.T) {
	m := match.NewMarket(uuid.New(), "stp-big")
	alice := uuid.New()

	// Alice rests an ask at 47 × 5.
	_, err := m.Submit(match.Order{
		ID: uuid.New(), MarketID: m.ID(), UserID: alice,
		Outcome: 0, Side: book.Ask, PriceCents: 47, Qty: 5,
	})
	require.NoError(t, err)

	// Alice's bid at 47 × 20 — maker (5) gets cancelled, bid rests with 20.
	res, err := m.Submit(match.Order{
		ID: uuid.New(), MarketID: m.ID(), UserID: alice,
		Outcome: 0, Side: book.Bid, PriceCents: 47, Qty: 20,
	})
	require.NoError(t, err)
	require.Empty(t, res.Fills)
	require.Equal(t, int64(20), res.RestingQty)
}

// 4. Partial fill — taker bigger than resting maker.
func TestPartialFill(t *testing.T) {
	m := match.NewMarket(uuid.New(), "partial")
	a, b := uuid.New(), uuid.New()

	// A asks 10 at 50.
	_, _ = m.Submit(match.Order{ID: uuid.New(), MarketID: m.ID(), UserID: a, Outcome: 0, Side: book.Ask, PriceCents: 50, Qty: 10})

	// B bids 25 at 50 — fills 10, rests 15.
	res, err := m.Submit(match.Order{ID: uuid.New(), MarketID: m.ID(), UserID: b, Outcome: 0, Side: book.Bid, PriceCents: 50, Qty: 25})
	require.NoError(t, err)
	require.Len(t, res.Fills, 1)
	require.Equal(t, int64(10), res.Fills[0].Qty)
	require.Equal(t, int64(15), res.RestingQty)

	// Bid book now has 15 at 50.
	snap, _ := m.Snapshot(0, book.Bid, 10)
	require.Len(t, snap.Levels, 1)
	require.Equal(t, int64(15), snap.Levels[0][1])
}

// 5. Cancel a resting order.
func TestCancelResting(t *testing.T) {
	m := match.NewMarket(uuid.New(), "cancel")
	a := uuid.New()
	id := uuid.New()

	_, err := m.Submit(match.Order{ID: id, MarketID: m.ID(), UserID: a, Outcome: 0, Side: book.Ask, PriceCents: 60, Qty: 30})
	require.NoError(t, err)

	qty, ok := m.Cancel(id)
	require.True(t, ok)
	require.Equal(t, int64(30), qty)

	snap, _ := m.Snapshot(0, book.Ask, 10)
	require.Empty(t, snap.Levels)
}

// 6. Fee calc matches the JS reference.
func TestCalcFeeCents(t *testing.T) {
	// JS: calcFeeCents(50, 1) === round(0.07 * 50 * 50 / 100) === round(1.75) === 2
	got, err := match.CalcFeeCents(50, 1)
	require.NoError(t, err)
	require.Equal(t, int64(2), got)

	// calcFeeCents(55, 10) === round(0.07 * 55 * 45 / 100) * 10 === round(1.7325)*10 === 2*10 == 20
	got, err = match.CalcFeeCents(55, 10)
	require.NoError(t, err)
	require.Equal(t, int64(20), got)

	// Symmetric around 50.
	a, _ := match.CalcFeeCents(40, 100)
	c, _ := match.CalcFeeCents(60, 100)
	require.Equal(t, a, c)

	// Out-of-range rejects.
	_, err = match.CalcFeeCents(0, 1)
	require.Error(t, err)
	_, err = match.CalcFeeCents(100, 1)
	require.Error(t, err)
	_, err = match.CalcFeeCents(50, 0)
	require.Error(t, err)
}

// 7. Bid/ask isolation: an ask on outcome 0 doesn't affect outcome 1.
func TestOutcomeIsolation(t *testing.T) {
	m := match.NewMarket(uuid.New(), "iso")
	u := uuid.New()
	_, _ = m.Submit(match.Order{ID: uuid.New(), MarketID: m.ID(), UserID: u, Outcome: 0, Side: book.Ask, PriceCents: 50, Qty: 10})
	snap1, _ := m.Snapshot(1, book.Ask, 10)
	require.Empty(t, snap1.Levels)
	snap0, _ := m.Snapshot(0, book.Ask, 10)
	require.Len(t, snap0.Levels, 1)
}
