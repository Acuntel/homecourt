package lmsr

import (
	"context"
	"log/slog"

	"github.com/Acuntel/homecourt/services/engine/internal/match"
)

// Manager runs a Bot per market in its own goroutine. One instance per
// engine process; cancel the context passed to Start to stop them all.
type Manager struct {
	bots []*Bot
}

// NewManager constructs a Manager with one bot per seed. Markets missing
// from the registry are logged + skipped so a partial-state boot can still
// quote what it has.
func NewManager(reg *match.Registry, seeds []MarketSeed, persister OrderPersister, log *slog.Logger) (*Manager, error) {
	bots := make([]*Bot, 0, len(seeds))
	for _, sd := range seeds {
		m := reg.Get(sd.MarketID)
		if m == nil {
			log.Warn("lmsr: market not in registry, skipping", "slug", sd.Slug)
			continue
		}
		bot, err := NewBot(m, sd, persister, log)
		if err != nil {
			return nil, err
		}
		bots = append(bots, bot)
	}
	return &Manager{bots: bots}, nil
}

// Start launches every bot's goroutine. Cancel the context to stop them all.
func (mgr *Manager) Start(ctx context.Context) {
	for _, b := range mgr.bots {
		go b.Run(ctx)
	}
}

// Count returns the number of active bots.
func (mgr *Manager) Count() int { return len(mgr.bots) }
