package lmsr_test

import (
	"context"
	"log/slog"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/Acuntel/homecourt/services/engine/internal/book"
	"github.com/Acuntel/homecourt/services/engine/internal/lmsr"
	"github.com/Acuntel/homecourt/services/engine/internal/match"
)

type fakePersister struct {
	mu       sync.Mutex
	inserts  int
	cancels  int
}

func (f *fakePersister) InsertOrder(_ context.Context, _ lmsr.OrderInput) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.inserts++
	return nil
}

func (f *fakePersister) CancelOrder(_ context.Context, _ uuid.UUID) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.cancels++
	return nil
}

// Bot posts quotes on first refresh — bids/asks present on every outcome.
func TestBotSeedsBookOnRefresh(t *testing.T) {
	m := match.NewMarket(uuid.New(), "bot-test")
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
	persister := &fakePersister{}

	seed := lmsr.MarketSeed{
		MarketID:       m.ID(),
		Slug:           "bot-test",
		ZestimateCents: 650_000_00, // $650K
		BucketLows:     []int64{0, 500_000_00, 600_000_00, 700_000_00, 800_000_00},
		BucketHighs:    []int64{499_999_99, 599_999_99, 699_999_99, 799_999_99, 1_000_000_00},
	}

	bot, err := lmsr.NewBot(m, seed, persister, logger)
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	bot.Run(ctx)

	// Every outcome should now have at least one bid and one ask resting.
	for outcome := 0; outcome < 5; outcome++ {
		bids, err := m.Snapshot(outcome, book.Bid, 5)
		require.NoError(t, err)
		require.NotEmpty(t, bids.Levels, "outcome %d has no bids", outcome)
		asks, err := m.Snapshot(outcome, book.Ask, 5)
		require.NoError(t, err)
		require.NotEmpty(t, asks.Levels, "outcome %d has no asks", outcome)
	}

	// At least 10 inserts (5 outcomes × 2 sides). Cancels are 0 on the
	// first refresh since nothing was resting.
	persister.mu.Lock()
	defer persister.mu.Unlock()
	require.GreaterOrEqual(t, persister.inserts, 10)
}

// Anchor price should be highest at the bucket containing the Zestimate.
func TestBotAnchorPrice(t *testing.T) {
	m := match.NewMarket(uuid.New(), "anchor-test")
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))

	// Zestimate=$725K → bucket 3 (700K..800K).
	seed := lmsr.MarketSeed{
		MarketID:       m.ID(),
		Slug:           "anchor-test",
		ZestimateCents: 725_000_00,
		BucketLows:     []int64{0, 500_000_00, 600_000_00, 700_000_00, 800_000_00},
		BucketHighs:    []int64{499_999_99, 599_999_99, 699_999_99, 799_999_99, 1_000_000_00},
	}
	bot, err := lmsr.NewBot(m, seed, nil, logger)
	require.NoError(t, err)

	prices := bot.State().AllPrices()
	require.Len(t, prices, 5)
	// Anchor (idx=3) should be highest.
	for i := 0; i < 5; i++ {
		if i == 3 {
			continue
		}
		require.Less(t, prices[i], prices[3],
			"non-anchor[%d]=%v should be < anchor=%v", i, prices[i], prices[3])
	}
}

// Manager wires up many bots and they run concurrently.
func TestManagerRunsManyBots(t *testing.T) {
	reg := match.NewRegistry()
	seeds := make([]lmsr.MarketSeed, 0, 3)
	for i := 0; i < 3; i++ {
		id := uuid.New()
		m := match.NewMarket(id, "mkt-"+id.String()[:8])
		reg.Add(m)
		seeds = append(seeds, lmsr.MarketSeed{
			MarketID:       id,
			Slug:           m.Slug(),
			ZestimateCents: 600_000_00,
			BucketLows:     []int64{0, 500_000_00, 600_000_00, 700_000_00, 800_000_00},
			BucketHighs:    []int64{499_999_99, 599_999_99, 699_999_99, 799_999_99, 1_000_000_00},
		})
	}
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
	mgr, err := lmsr.NewManager(reg, seeds, nil, logger)
	require.NoError(t, err)
	require.Equal(t, 3, mgr.Count())

	ctx, cancel := context.WithTimeout(context.Background(), 150*time.Millisecond)
	defer cancel()
	mgr.Start(ctx)
	// Give the goroutines a moment to seed.
	time.Sleep(50 * time.Millisecond)

	for _, m := range reg.All() {
		bids, _ := m.Snapshot(0, book.Bid, 1)
		asks, _ := m.Snapshot(0, book.Ask, 1)
		require.NotEmpty(t, bids.Levels, "market %s no bids", m.Slug())
		require.NotEmpty(t, asks.Levels, "market %s no asks", m.Slug())
	}

	<-ctx.Done()
}
