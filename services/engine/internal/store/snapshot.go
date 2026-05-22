package store

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/Acuntel/homecourt/services/engine/internal/book"
	"github.com/Acuntel/homecourt/services/engine/internal/match"
)

// SnapshotMarket serializes the full book state of a market into a SnapshotBlob.
func SnapshotMarket(m *match.Market) SnapshotBlob {
	now := time.Now().UTC()
	blob := SnapshotBlob{
		MarketID: m.ID().String(),
		TakenAt:  now.Format(time.RFC3339Nano),
		Books:    make([]SnapshotBook, 5),
	}
	// Bucket per outcome.
	for i := 0; i < 5; i++ {
		blob.Books[i] = SnapshotBook{Outcome: i, Bids: nil, Asks: nil}
	}
	for _, entry := range m.AllResting() {
		row := SnapshotOrderRow{
			ID:         entry.Order.ID.String(),
			UserID:     entry.Order.UserID.String(),
			PriceCents: entry.Order.PriceCents,
			Qty:        entry.Order.Qty,
			Remaining:  entry.Order.Remaining,
			CreatedAt:  entry.Order.CreatedAt.UnixNano(),
		}
		if entry.Side == book.Bid {
			blob.Books[entry.Outcome].Bids = append(blob.Books[entry.Outcome].Bids, row)
		} else {
			blob.Books[entry.Outcome].Asks = append(blob.Books[entry.Outcome].Asks, row)
		}
	}
	return blob
}

// RestoreMarket walks a SnapshotBlob and replays it into m.
// Caller is responsible for setting market.Seq afterwards.
func RestoreMarket(m *match.Market, blob *SnapshotBlob) error {
	for _, bk := range blob.Books {
		for _, r := range bk.Bids {
			id, err := uuid.Parse(r.ID)
			if err != nil {
				return err
			}
			uid, err := uuid.Parse(r.UserID)
			if err != nil {
				return err
			}
			o := &book.Order{
				ID: id, UserID: uid, Side: book.Bid,
				PriceCents: r.PriceCents, Qty: r.Qty, Remaining: r.Remaining,
				CreatedAt: time.Unix(0, r.CreatedAt).UTC(),
			}
			if err := m.LoadResting(bk.Outcome, book.Bid, o); err != nil {
				return err
			}
		}
		for _, r := range bk.Asks {
			id, err := uuid.Parse(r.ID)
			if err != nil {
				return err
			}
			uid, err := uuid.Parse(r.UserID)
			if err != nil {
				return err
			}
			o := &book.Order{
				ID: id, UserID: uid, Side: book.Ask,
				PriceCents: r.PriceCents, Qty: r.Qty, Remaining: r.Remaining,
				CreatedAt: time.Unix(0, r.CreatedAt).UTC(),
			}
			if err := m.LoadResting(bk.Outcome, book.Ask, o); err != nil {
				return err
			}
		}
	}
	return nil
}

// SnapshotLoop runs forever, snapshotting every interval until ctx is done.
// markets is a snapshot of the registry at boot; new markets added later
// won't appear (M6 boots a fixed set).
//
// On shutdown the loop performs ONE final snapshot using a fresh background
// context with a 10s timeout, so a cancelled root context does not abort
// the final write.
func SnapshotLoop(ctx context.Context, s *Store, markets []*match.Market, interval time.Duration, onErr func(error)) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			// Final snapshot on the way out — fresh context.
			final, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			snapshotAll(final, s, markets, onErr)
			cancel()
			return
		case <-t.C:
			snapshotAll(ctx, s, markets, onErr)
		}
	}
}

func snapshotAll(ctx context.Context, s *Store, markets []*match.Market, onErr func(error)) {
	for _, m := range markets {
		blob := SnapshotMarket(m)
		if err := s.WriteSnapshot(ctx, m.ID(), blob, m.Seq()); err != nil && onErr != nil {
			onErr(err)
		}
	}
}
