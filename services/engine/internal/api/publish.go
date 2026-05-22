package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/Acuntel/homecourt/services/engine/internal/book"
	"github.com/Acuntel/homecourt/services/engine/internal/match"
)

// publishFills emits trade + per-user fill events to NATS + ws hub.
func (s *Server) publishFills(m *match.Market, outcome int, side string, fills []book.Fill) {
	if s.Bus == nil && s.Hub == nil {
		return
	}
	for _, f := range fills {
		payload := map[string]any{
			"channel": fmt.Sprintf("trade:%s", m.Slug()),
			"type":    "trade",
			"market":  m.Slug(),
			"outcome": outcome,
			"price":   f.PriceCents,
			"qty":     f.Qty,
			"side":    side,
			"ts":      f.Ts.UTC().Format(time.RFC3339Nano),
		}
		raw, _ := json.Marshal(payload)
		if s.Bus != nil {
			_ = s.Bus.PublishTrade(m.Slug(), raw)
		}
		if s.Hub != nil {
			s.Hub.Broadcast(fmt.Sprintf("trade:%s", m.Slug()), raw)
		}
		// Per-user fill notifications.
		for _, uid := range []string{f.TakerUserID.String(), f.MakerUserID.String()} {
			fp := map[string]any{
				"channel": fmt.Sprintf("fill:%s", uid),
				"type":    "fill",
				"market":  m.Slug(),
				"outcome": outcome,
				"price":   f.PriceCents,
				"qty":     f.Qty,
				"ts":      f.Ts.UTC().Format(time.RFC3339Nano),
			}
			fpRaw, _ := json.Marshal(fp)
			if s.Bus != nil {
				_ = s.Bus.PublishFill(uid, fpRaw)
			}
			if s.Hub != nil {
				s.Hub.Broadcast(fmt.Sprintf("fill:%s", uid), fpRaw)
			}
		}
	}
}

// publishBook emits an L2 snapshot delta for a single outcome.
func (s *Server) publishBook(m *match.Market, outcome int) {
	if s.Bus == nil && s.Hub == nil {
		return
	}
	bids, err := m.Snapshot(outcome, book.Bid, 20)
	if err != nil {
		return
	}
	asks, _ := m.Snapshot(outcome, book.Ask, 20)
	payload := map[string]any{
		"channel": fmt.Sprintf("orderbook:%s:%d", m.Slug(), outcome),
		"type":    "orderbook_delta",
		"market":  m.Slug(),
		"outcome": outcome,
		"seq":     m.Seq(),
		"bids":    bids.Levels,
		"asks":    asks.Levels,
		"ts":      time.Now().UTC().Format(time.RFC3339Nano),
	}
	raw, _ := json.Marshal(payload)
	if s.Bus != nil {
		_ = s.Bus.PublishBookDelta(m.Slug(), raw)
	}
	if s.Hub != nil {
		s.Hub.Broadcast(fmt.Sprintf("orderbook:%s:%d", m.Slug(), outcome), raw)
	}
}

// --- response helpers --------------------------------------------------------

func writeJSON(w http.ResponseWriter, status int, v any) {
	raw, err := json.Marshal(v)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSONRaw(w, status, raw)
}

func writeJSONRaw(w http.ResponseWriter, status int, raw []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(raw)
}

func writeError(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, map[string]any{"error": code, "message": msg})
}
