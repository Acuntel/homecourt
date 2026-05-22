// Package nats wraps the JetStream client for HOMECOURT engine WAL +
// pub topics.
//
// Stream: engine.wal (file storage, retention=limits)
//   subjects: engine.wal.>
// Pub topics:
//   engine.tick.<marketSlug>
//   engine.book.<marketSlug>
//   engine.fill.<userId>
//   engine.lifecycle.<marketSlug>
package natsx

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

// Bus is the engine's outbound + inbound NATS handle.
type Bus struct {
	conn   *nats.Conn
	js     jetstream.JetStream
	stream jetstream.Stream
}

// Connect dials NATS at url and ensures the WAL stream exists.
func Connect(ctx context.Context, url string) (*Bus, error) {
	c, err := nats.Connect(url,
		nats.Name("homecourt-engine"),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(time.Second),
	)
	if err != nil {
		return nil, fmt.Errorf("nats connect: %w", err)
	}
	js, err := jetstream.New(c)
	if err != nil {
		c.Close()
		return nil, fmt.Errorf("jetstream: %w", err)
	}
	// Ensure WAL stream exists.
	stream, err := js.CreateStream(ctx, jetstream.StreamConfig{
		Name:        "ENGINE_WAL",
		Subjects:    []string{"engine.wal.>"},
		Retention:   jetstream.LimitsPolicy,
		Storage:     jetstream.FileStorage,
		MaxAge:      24 * time.Hour,
		MaxMsgs:     1_000_000,
		Replicas:    1,
	})
	if err != nil {
		// If it already exists, fetch it.
		stream, err = js.Stream(ctx, "ENGINE_WAL")
		if err != nil {
			c.Close()
			return nil, fmt.Errorf("get stream: %w", err)
		}
	}
	return &Bus{conn: c, js: js, stream: stream}, nil
}

// Close drains and disconnects.
func (b *Bus) Close() {
	if b.conn != nil {
		_ = b.conn.Drain()
	}
}

// WALEntry is one entry written to engine.wal.<marketSlug>.
type WALEntry struct {
	Seq        uint64    `json:"seq"`
	Kind       string    `json:"kind"` // "order" | "cancel"
	MarketSlug string    `json:"market_slug"`
	MarketID   string    `json:"market_id"`
	OrderID    string    `json:"order_id"`
	UserID     string    `json:"user_id,omitempty"`
	Outcome    int       `json:"outcome,omitempty"`
	Side       string    `json:"side,omitempty"`        // "bid" | "ask"
	PriceCents int32     `json:"price_cents,omitempty"`
	Qty        int64     `json:"qty,omitempty"`
	Ts         time.Time `json:"ts"`
}

// PublishWAL synchronously appends a WAL entry. Caller MUST wait for ack
// before responding to the client to guarantee replay safety.
func (b *Bus) PublishWAL(ctx context.Context, entry WALEntry) error {
	raw, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("marshal wal: %w", err)
	}
	subject := fmt.Sprintf("engine.wal.%s", entry.MarketSlug)
	if _, err := b.js.Publish(ctx, subject, raw); err != nil {
		return fmt.Errorf("publish wal: %w", err)
	}
	return nil
}

// PublishTrade emits a trade event to engine.tick.<slug>.
func (b *Bus) PublishTrade(slug string, payload []byte) error {
	return b.conn.Publish(fmt.Sprintf("engine.tick.%s", slug), payload)
}

// PublishBookDelta emits a book delta to engine.book.<slug>.
func (b *Bus) PublishBookDelta(slug string, payload []byte) error {
	return b.conn.Publish(fmt.Sprintf("engine.book.%s", slug), payload)
}

// PublishFill emits a per-user fill notification to engine.fill.<userId>.
func (b *Bus) PublishFill(userID string, payload []byte) error {
	return b.conn.Publish(fmt.Sprintf("engine.fill.%s", userID), payload)
}

// PublishLifecycle emits a market lifecycle event.
func (b *Bus) PublishLifecycle(slug string, payload []byte) error {
	return b.conn.Publish(fmt.Sprintf("engine.lifecycle.%s", slug), payload)
}

// Conn exposes the raw nats.Conn for subscribers (ws hub).
func (b *Bus) Conn() *nats.Conn { return b.conn }

// ReplayAfter consumes WAL entries for a given market after `lastSeq`. It
// invokes `handle` for each entry; if handle returns an error the replay
// stops and the error is propagated. Bounded by `maxMsgs` to avoid runaway.
func (b *Bus) ReplayAfter(ctx context.Context, marketSlug string, lastSeq uint64, maxMsgs int, handle func(WALEntry) error) error {
	if maxMsgs <= 0 {
		maxMsgs = 10_000
	}
	subject := fmt.Sprintf("engine.wal.%s", marketSlug)
	cons, err := b.stream.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{
		Name:          fmt.Sprintf("replay-%s-%d", marketSlug, time.Now().UnixNano()),
		FilterSubject: subject,
		AckPolicy:     jetstream.AckExplicitPolicy,
		DeliverPolicy: jetstream.DeliverAllPolicy,
	})
	if err != nil {
		return fmt.Errorf("create consumer: %w", err)
	}
	defer func() { _ = b.stream.DeleteConsumer(ctx, cons.CachedInfo().Name) }()

	count := 0
	for count < maxMsgs {
		batch, err := cons.Fetch(50, jetstream.FetchMaxWait(500*time.Millisecond))
		if err != nil {
			return fmt.Errorf("fetch: %w", err)
		}
		got := 0
		for msg := range batch.Messages() {
			got++
			var entry WALEntry
			if err := json.Unmarshal(msg.Data(), &entry); err != nil {
				_ = msg.Term()
				continue
			}
			_ = msg.Ack()
			if entry.Seq <= lastSeq {
				continue
			}
			if err := handle(entry); err != nil {
				return err
			}
			count++
		}
		if got == 0 {
			break
		}
	}
	return nil
}
