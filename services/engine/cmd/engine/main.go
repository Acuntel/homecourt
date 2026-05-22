// Command engine boots the HOMECOURT matching engine: loads markets, opens
// NATS JetStream, exposes HTTP+WS on :8080, and graceful-shuts on SIGTERM.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/Acuntel/homecourt/services/engine/internal/api"
	"github.com/Acuntel/homecourt/services/engine/internal/auth"
	"github.com/Acuntel/homecourt/services/engine/internal/match"
	natsx "github.com/Acuntel/homecourt/services/engine/internal/nats"
	"github.com/Acuntel/homecourt/services/engine/internal/store"
	wsx "github.com/Acuntel/homecourt/services/engine/internal/ws"
)

const defaultDatabaseURL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
const defaultNATSURL = "nats://localhost:4222"
const defaultJWKSURL = "http://127.0.0.1:54321/auth/v1/.well-known/jwks.json"

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(log)

	if err := run(log); err != nil {
		log.Error("engine fatal", "err", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	rootCtx, cancel := context.WithCancel(context.Background())
	defer cancel()

	databaseURL := envOr("DATABASE_URL", defaultDatabaseURL)
	natsURL := envOr("NATS_URL", defaultNATSURL)
	jwksURL := envOr("ENGINE_JWKS_URL", defaultJWKSURL)
	hsSecret := os.Getenv("ENGINE_JWT_SECRET")
	port := envOr("ENGINE_PORT", "8080")
	snapshotEvery := envDur("ENGINE_SNAPSHOT_INTERVAL", 5*time.Second)
	disableNATS := os.Getenv("ENGINE_DISABLE_NATS") == "1"

	// --- Postgres ----------------------------------------------------------
	pool, err := store.Connect(rootCtx, databaseURL)
	if err != nil {
		return fmt.Errorf("postgres: %w", err)
	}
	defer pool.Close()
	st := store.New(pool)
	log.Info("postgres connected", "url", redactURL(databaseURL))

	// --- NATS --------------------------------------------------------------
	var bus *natsx.Bus
	if !disableNATS {
		bus, err = natsx.Connect(rootCtx, natsURL)
		if err != nil {
			log.Warn("nats unavailable — continuing without WAL", "err", err)
			bus = nil
		} else {
			defer bus.Close()
			log.Info("nats connected", "url", natsURL)
		}
	}

	// --- Auth --------------------------------------------------------------
	verifier := auth.NewVerifier(jwksURL, hsSecret)

	// --- Match registry ----------------------------------------------------
	reg := match.NewRegistry()
	markets, err := st.LoadOpenMarkets(rootCtx)
	if err != nil {
		return fmt.Errorf("load markets: %w", err)
	}
	for _, m := range markets {
		mk := match.NewMarket(m.ID, m.Slug)
		reg.Add(mk)
	}
	log.Info("markets loaded", "count", reg.Count())

	// --- Replay snapshots --------------------------------------------------
	restoredCount := 0
	for _, m := range reg.All() {
		blob, lastSeq, err := st.LatestSnapshot(rootCtx, m.ID())
		if err != nil {
			log.Warn("snapshot load failed", "market", m.Slug(), "err", err)
			continue
		}
		if blob == nil {
			continue
		}
		if err := store.RestoreMarket(m, blob); err != nil {
			log.Warn("snapshot restore failed", "market", m.Slug(), "err", err)
			continue
		}
		m.SetSeq(lastSeq)
		restoredCount++
	}
	if restoredCount > 0 {
		log.Info("snapshots restored", "count", restoredCount)
	}

	// --- WS hub ------------------------------------------------------------
	hub := wsx.NewHub(log, verifier)

	// --- HTTP server -------------------------------------------------------
	srv := &api.Server{
		Log:      log,
		Reg:      reg,
		Store:    st,
		Bus:      bus,
		Hub:      hub,
		Verifier: verifier,
		Started:  time.Now(),
	}
	httpSrv := &http.Server{
		Addr:              ":" + port,
		Handler:           srv.Routes(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	// --- Snapshot loop -----------------------------------------------------
	snapCtx, snapCancel := context.WithCancel(rootCtx)
	defer snapCancel()
	go store.SnapshotLoop(snapCtx, st, reg.All(), snapshotEvery, func(err error) {
		log.Warn("snapshot loop", "err", err)
	})

	// --- Listen ------------------------------------------------------------
	errCh := make(chan error, 1)
	go func() {
		log.Info("http listening", "addr", httpSrv.Addr)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	// --- Wait for signal ---------------------------------------------------
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)

	select {
	case sig := <-sigCh:
		log.Info("shutdown signal", "sig", sig.String())
	case err := <-errCh:
		return fmt.Errorf("http server: %w", err)
	}

	// --- Graceful shutdown -------------------------------------------------
	shutCtx, shutCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutCancel()

	hub.Shutdown(shutCtx)
	_ = httpSrv.Shutdown(shutCtx)

	snapCancel() // triggers final snapshot via SnapshotLoop's <-ctx.Done() branch
	// give the snapshot loop a moment to flush
	time.Sleep(500 * time.Millisecond)

	log.Info("engine stopped")
	return nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envDur(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	if n, err := strconv.Atoi(v); err == nil {
		return time.Duration(n) * time.Second
	}
	if d, err := time.ParseDuration(v); err == nil {
		return d
	}
	return fallback
}

func redactURL(u string) string {
	// don't bother — just hide password if present
	at := -1
	for i := 0; i < len(u); i++ {
		if u[i] == '@' {
			at = i
			break
		}
	}
	if at < 0 {
		return u
	}
	// find scheme end
	sch := -1
	for i := 0; i+2 < len(u); i++ {
		if u[i] == ':' && u[i+1] == '/' && u[i+2] == '/' {
			sch = i + 3
			break
		}
	}
	if sch < 0 || sch >= at {
		return u
	}
	return u[:sch] + "***" + u[at:]
}
