package store

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"

	"github.com/Acuntel/homecourt/services/engine/internal/lmsr"
)

func decodeJSON(raw []byte, v any) error { return json.Unmarshal(raw, v) }

// HouseSeedCashCents is the starting cash balance for the house MM account
// ($1M). Funds the bot's quote posting; settles back into the system on
// market resolution.
const HouseSeedCashCents int64 = 100_000_000

// EnsureHouseMm idempotently inserts the house market-maker user + account
// rows used by the LS-LMSR bot. Safe to call on every engine boot.
//
// Steps:
//  1. Insert into auth.users (if the schema exists) with the fixed UUID.
//  2. Insert into public.users (mirror row with username='house_mm').
//  3. Insert into public.accounts seeded with $1M cash.
//
// If `auth.users` doesn't exist (bare Postgres with no Supabase auth schema)
// we drop the FK before inserting into public.users. This keeps local-dev
// runs working without a full Supabase stack.
func (s *Store) EnsureHouseMm(ctx context.Context) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	houseID := lmsr.HouseUserID

	// Detect whether auth.users exists. If yes, seed it; if no, drop the FK
	// on public.users so the next insert succeeds.
	var hasAuth bool
	if err := tx.QueryRow(ctx, `
		select exists (
			select 1 from information_schema.tables
			where table_schema = 'auth' and table_name = 'users'
		)`).Scan(&hasAuth); err != nil {
		return fmt.Errorf("check auth schema: %w", err)
	}

	if hasAuth {
		// Insert into auth.users — the trigger on_auth_user_created will
		// mirror into public.users. We also INSERT directly into
		// public.users below as a fallback in case the trigger isn't wired.
		if _, err := tx.Exec(ctx, `
			insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
			values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now(), now())
			on conflict (id) do nothing
		`, houseID, "house@homecourt.local"); err != nil {
			// Don't fail boot — some local instances have a hand-crafted
			// auth schema we shouldn't touch. Log via returned error chain.
			return fmt.Errorf("insert auth.users: %w", err)
		}
	} else {
		// Local dev with bare Postgres — drop the FK so we can insert.
		if _, err := tx.Exec(ctx, `
			alter table public.users drop constraint if exists users_id_fkey
		`); err != nil {
			return fmt.Errorf("drop users_id_fkey: %w", err)
		}
	}

	// Insert public.users row.
	if _, err := tx.Exec(ctx, `
		insert into public.users (id, email, username, display_name, kyc_status)
		values ($1, $2, 'house_mm', 'HOMECOURT House', 'approved')
		on conflict (id) do nothing
	`, houseID, "house@homecourt.local"); err != nil {
		return fmt.Errorf("insert public.users: %w", err)
	}

	// Insert public.accounts row seeded with $1M.
	if _, err := tx.Exec(ctx, `
		insert into public.accounts (user_id, cash_cents, locked_cents)
		values ($1, $2, 0)
		on conflict (user_id) do nothing
	`, houseID, HouseSeedCashCents); err != nil {
		return fmt.Errorf("insert public.accounts: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// LoadMarketSeeds returns the per-market info the LS-LMSR bot needs to seed
// its q vector (Zestimate + bucket ranges). Excludes settled/voided markets.
func (s *Store) LoadMarketSeeds(ctx context.Context) ([]lmsr.MarketSeed, error) {
	const q = `
		select
		  m.id,
		  m.slug,
		  p.zestimate_cents,
		  m.buckets
		from public.markets m
		join public.properties p on p.id = m.property_id
		where m.state = 'open'
		order by m.created_at asc
	`
	rows, err := s.pool.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("load market seeds: %w", err)
	}
	defer rows.Close()

	var out []lmsr.MarketSeed
	for rows.Next() {
		var id uuid.UUID
		var slug string
		var zest int64
		var bucketsRaw []byte
		if err := rows.Scan(&id, &slug, &zest, &bucketsRaw); err != nil {
			return nil, fmt.Errorf("scan seed: %w", err)
		}
		buckets, err := parseBuckets(bucketsRaw)
		if err != nil {
			return nil, fmt.Errorf("parse buckets for %s: %w", slug, err)
		}
		lows := make([]int64, len(buckets))
		highs := make([]int64, len(buckets))
		for i, b := range buckets {
			lows[i] = b.LowCents
			highs[i] = b.HighCents
		}
		out = append(out, lmsr.MarketSeed{
			MarketID:       id,
			Slug:           slug,
			ZestimateCents: zest,
			BucketLows:     lows,
			BucketHighs:    highs,
		})
	}
	return out, rows.Err()
}

func parseBuckets(raw []byte) ([]Bucket, error) {
	var buckets []Bucket
	if err := decodeJSON(raw, &buckets); err != nil {
		return nil, err
	}
	return buckets, nil
}

// HouseAdapter adapts *Store to the lmsr.OrderPersister interface so the bot
// can persist orders without importing store (avoids package cycle).
type HouseAdapter struct{ S *Store }

// InsertOrder satisfies lmsr.OrderPersister.
func (h *HouseAdapter) InsertOrder(ctx context.Context, in lmsr.OrderInput) error {
	return h.S.InsertOrder(ctx, InsertOrderInput{
		ID:                   in.ID,
		ClientIdempotencyKey: in.ClientIdempotencyKey,
		MarketID:             in.MarketID,
		UserID:               in.UserID,
		Outcome:              in.Outcome,
		Side:                 OrderSide(in.Side),
		PriceCents:           in.PriceCents,
		Qty:                  in.Qty,
	})
}

// CancelOrder satisfies lmsr.OrderPersister.
func (h *HouseAdapter) CancelOrder(ctx context.Context, id uuid.UUID) error {
	return h.S.CancelOrder(ctx, id)
}
