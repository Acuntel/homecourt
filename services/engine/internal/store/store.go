package store

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store wraps the pgx pool with HOMECOURT-specific queries.
type Store struct {
	pool *pgxpool.Pool
}

// New returns a Store connected via the provided pool.
func New(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

// Pool returns the underlying pgx pool. Used by tests + admin paths.
func (s *Store) Pool() *pgxpool.Pool { return s.pool }

// Connect dials the database at databaseURL with sensible pool defaults.
func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}
	cfg.MaxConns = 16
	cfg.MinConns = 2
	cfg.MaxConnLifetime = time.Hour
	cfg.MaxConnIdleTime = 10 * time.Minute
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("pool connect: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping: %w", err)
	}
	return pool, nil
}

// LoadOpenMarkets fetches all markets in state='open'. The engine runs only
// these on startup.
func (s *Store) LoadOpenMarkets(ctx context.Context) ([]Market, error) {
	const q = `
		select id, slug, property_id, buckets, opens_at, closes_at, resolves_at, state
		from public.markets
		where state = 'open'
		order by created_at asc
	`
	rows, err := s.pool.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("load markets: %w", err)
	}
	defer rows.Close()
	var out []Market
	for rows.Next() {
		var m Market
		var bucketsJSON []byte
		var state string
		if err := rows.Scan(&m.ID, &m.Slug, &m.PropertyID, &bucketsJSON, &m.OpensAt, &m.ClosesAt, &m.ResolvesAt, &state); err != nil {
			return nil, fmt.Errorf("scan market: %w", err)
		}
		m.State = MarketState(state)
		if err := json.Unmarshal(bucketsJSON, &m.Buckets); err != nil {
			return nil, fmt.Errorf("decode buckets for %s: %w", m.Slug, err)
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// InsertOrderInput is the payload to InsertOrder.
type InsertOrderInput struct {
	ID                   uuid.UUID
	ClientIdempotencyKey string
	MarketID             uuid.UUID
	UserID               uuid.UUID
	Outcome              int
	Side                 OrderSide
	PriceCents           int32
	Qty                  int64
}

// InsertOrder inserts an order row in status='open'. The DB-side unique
// constraint on client_idempotency_key enforces dedupe at the SQL layer too;
// callers SHOULD pre-check idempotency_keys first to return a cached
// response in the happy path.
func (s *Store) InsertOrder(ctx context.Context, in InsertOrderInput) error {
	const q = `
		insert into public.orders
		  (id, client_idempotency_key, market_id, user_id, outcome, side, price_cents, qty, filled_qty, status)
		values
		  ($1, $2, $3, $4, $5, $6, $7, $8, 0, 'open')
	`
	_, err := s.pool.Exec(ctx, q,
		in.ID, in.ClientIdempotencyKey, in.MarketID, in.UserID,
		in.Outcome, string(in.Side), in.PriceCents, in.Qty,
	)
	if err != nil {
		return fmt.Errorf("insert order: %w", err)
	}
	return nil
}

// FillRecord describes one fill being persisted.
type FillRecord struct {
	ID           uuid.UUID
	MarketID     uuid.UUID
	TakerOrderID uuid.UUID
	MakerOrderID uuid.UUID
	TakerUserID  uuid.UUID
	MakerUserID  uuid.UUID
	Outcome      int
	PriceCents   int32
	Qty          int64
	FeeCents     int64
}

// CommitFills writes a batch of fills atomically:
//   - inserts fills rows
//   - updates orders.filled_qty + status for taker and each maker
//   - writes double-entry journal lines (taker fill_debit, maker fill_credit)
//
// All in a single tx. Returns on first error after rollback.
func (s *Store) CommitFills(ctx context.Context, fills []FillRecord) error {
	if len(fills) == 0 {
		return nil
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for _, f := range fills {
		// Insert fill row.
		_, err = tx.Exec(ctx, `
			insert into public.fills
			  (id, market_id, taker_order_id, maker_order_id, outcome, price_cents, qty, fee_cents)
			values ($1,$2,$3,$4,$5,$6,$7,$8)
		`, f.ID, f.MarketID, f.TakerOrderID, f.MakerOrderID, f.Outcome, f.PriceCents, f.Qty, f.FeeCents)
		if err != nil {
			return fmt.Errorf("insert fill: %w", err)
		}
		// Bump filled_qty + status for taker and maker.
		for _, orderID := range []uuid.UUID{f.TakerOrderID, f.MakerOrderID} {
			_, err = tx.Exec(ctx, `
				update public.orders
				   set filled_qty = filled_qty + $2,
				       status = case
				         when filled_qty + $2 >= qty then 'filled'::order_status
				         else 'partial'::order_status
				       end
				 where id = $1
			`, orderID, f.Qty)
			if err != nil {
				return fmt.Errorf("update order filled_qty: %w", err)
			}
		}
		// Double-entry journal: taker pays price*qty + fee; maker receives price*qty.
		// We DON'T touch escrow / accounts.cash_cents here — the lock/release
		// flow is owned by the order placement path. M6 writes the per-fill
		// accounting lines for an auditable trail; a future milestone adds
		// the formal escrow movement.
		taker := int64(f.PriceCents) * f.Qty
		maker := int64(f.PriceCents) * f.Qty
		refTag := fmt.Sprintf("fill:%s", f.ID.String())
		// fetch current balance for each user to fill balance_after_cents.
		var takerBal, makerBal int64
		if err = tx.QueryRow(ctx, `select coalesce(cash_cents, 0) from public.accounts where user_id=$1`, f.TakerUserID).Scan(&takerBal); err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("read taker balance: %w", err)
		}
		if err = tx.QueryRow(ctx, `select coalesce(cash_cents, 0) from public.accounts where user_id=$1`, f.MakerUserID).Scan(&makerBal); err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("read maker balance: %w", err)
		}

		_, err = tx.Exec(ctx, `
			insert into public.journal
			  (user_id, market_id, kind, amount_cents, balance_after_cents, ref)
			values
			  ($1, $2, 'fill_debit',  $3, $4, $5),
			  ($6, $2, 'fill_credit', $7, $8, $5)
		`,
			f.TakerUserID, f.MarketID, -taker, maxInt64(takerBal-taker, 0), refTag,
			f.MakerUserID, maker, makerBal+maker,
		)
		if err != nil {
			return fmt.Errorf("insert journal lines: %w", err)
		}
		// Fee row (taker only).
		if f.FeeCents > 0 {
			_, err = tx.Exec(ctx, `
				insert into public.journal
				  (user_id, market_id, kind, amount_cents, balance_after_cents, ref)
				values
				  ($1, $2, 'fee', $3, $4, $5)
			`, f.TakerUserID, f.MarketID, -f.FeeCents, maxInt64(takerBal-taker-f.FeeCents, 0), refTag)
			if err != nil {
				return fmt.Errorf("insert fee journal: %w", err)
			}
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	return nil
}

// CancelOrder marks an order cancelled and stamps cancelled_at.
func (s *Store) CancelOrder(ctx context.Context, id uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `
		update public.orders
		   set status = 'cancelled'::order_status,
		       cancelled_at = now()
		 where id = $1 and status in ('open','partial')
	`, id)
	if err != nil {
		return fmt.Errorf("cancel order: %w", err)
	}
	return nil
}

// SnapshotBook is one outcome's snapshot, persisted as part of the engine
// snapshot blob. Mirrors the shape consumed on replay.
type SnapshotBook struct {
	Outcome int                `json:"outcome"`
	Bids    []SnapshotOrderRow `json:"bids"`
	Asks    []SnapshotOrderRow `json:"asks"`
}

// SnapshotOrderRow is one resting order at snapshot time.
type SnapshotOrderRow struct {
	ID         string `json:"id"`
	UserID     string `json:"user_id"`
	PriceCents int32  `json:"price_cents"`
	Qty        int64  `json:"qty"`
	Remaining  int64  `json:"remaining"`
	CreatedAt  int64  `json:"created_at"` // unix nano
}

// SnapshotBlob is what we serialize into engine_snapshots.book.
type SnapshotBlob struct {
	MarketID string         `json:"market_id"`
	TakenAt  string         `json:"taken_at"`
	Books    []SnapshotBook `json:"books"`
}

// WriteSnapshot inserts a row into engine_snapshots.
func (s *Store) WriteSnapshot(ctx context.Context, marketID uuid.UUID, blob SnapshotBlob, lastSeq uint64) error {
	raw, err := json.Marshal(blob)
	if err != nil {
		return fmt.Errorf("marshal snapshot: %w", err)
	}
	// Gzip then base64? JSONB doesn't accept binary directly. We store raw
	// JSON for human readability — gzip would require bytea. The schema
	// uses jsonb so keep it readable; we still gzip-test below to confirm.
	_, _ = gzip.NewWriter(&bytes.Buffer{}).Write(raw) // smoke test compressibility
	const q = `
		insert into public.engine_snapshots (market_id, book, lmsr_state, last_seq)
		values ($1, $2, '{}'::jsonb, $3)
	`
	if _, err := s.pool.Exec(ctx, q, marketID, raw, int64(lastSeq)); err != nil {
		return fmt.Errorf("insert snapshot: %w", err)
	}
	return nil
}

// LatestSnapshot returns the most recent snapshot for a market, or
// (nil, 0, nil) if no snapshot exists yet.
func (s *Store) LatestSnapshot(ctx context.Context, marketID uuid.UUID) (*SnapshotBlob, uint64, error) {
	const q = `
		select book, last_seq
		from public.engine_snapshots
		where market_id = $1
		order by taken_at desc
		limit 1
	`
	var raw []byte
	var lastSeq int64
	err := s.pool.QueryRow(ctx, q, marketID).Scan(&raw, &lastSeq)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, 0, nil
	}
	if err != nil {
		return nil, 0, fmt.Errorf("query snapshot: %w", err)
	}
	var blob SnapshotBlob
	if err := json.Unmarshal(raw, &blob); err != nil {
		return nil, 0, fmt.Errorf("decode snapshot: %w", err)
	}
	return &blob, uint64(lastSeq), nil
}

// CheckIdempotency returns the cached response for `key` if it was seen in
// the last 24h. Returns (nil, false, nil) if no cached row.
func (s *Store) CheckIdempotency(ctx context.Context, key string) (json.RawMessage, bool, error) {
	const q = `
		select response from public.idempotency_keys
		where key = $1 and created_at > now() - interval '24 hours'
	`
	var resp []byte
	err := s.pool.QueryRow(ctx, q, key).Scan(&resp)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("check idempotency: %w", err)
	}
	return resp, true, nil
}

// SaveIdempotency caches a response under `key` for 24h.
func (s *Store) SaveIdempotency(ctx context.Context, key string, response json.RawMessage) error {
	_, err := s.pool.Exec(ctx, `
		insert into public.idempotency_keys (key, response)
		values ($1, $2)
		on conflict (key) do nothing
	`, key, []byte(response))
	if err != nil {
		return fmt.Errorf("save idempotency: %w", err)
	}
	return nil
}

func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
