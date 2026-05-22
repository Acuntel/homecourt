// Package api exposes the HTTP surface of the engine:
//
//	POST   /v1/orders                            place an order
//	DELETE /v1/orders/:id                        cancel an order
//	GET    /v1/book/:marketId/:outcomeIdx        L2 snapshot (depth=20)
//	GET    /v1/health                            liveness + market count
//	GET    /v1/ws                                websocket upgrade
package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/Acuntel/homecourt/services/engine/internal/auth"
	"github.com/Acuntel/homecourt/services/engine/internal/book"
	"github.com/Acuntel/homecourt/services/engine/internal/match"
	natsx "github.com/Acuntel/homecourt/services/engine/internal/nats"
	"github.com/Acuntel/homecourt/services/engine/internal/store"
	wsx "github.com/Acuntel/homecourt/services/engine/internal/ws"
)

// Server bundles all engine dependencies into the HTTP handlers.
type Server struct {
	Log      *slog.Logger
	Reg      *match.Registry
	Store    *store.Store
	Bus      *natsx.Bus
	Hub      *wsx.Hub
	Verifier *auth.Verifier
	Started  time.Time
}

// Routes registers all handlers on a new ServeMux.
func (s *Server) Routes() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/health", s.handleHealth)
	mux.HandleFunc("POST /v1/orders", s.handlePlaceOrder)
	mux.HandleFunc("DELETE /v1/orders/{id}", s.handleCancelOrder)
	mux.HandleFunc("GET /v1/book/{marketId}/{outcomeIdx}", s.handleBookSnapshot)
	mux.HandleFunc("GET /v1/ws", s.Hub.HandleHTTP)
	return mux
}

// handleHealth — liveness + active market count.
func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":         "ok",
		"markets_active": s.Reg.Count(),
		"uptime_seconds": int(time.Since(s.Started).Seconds()),
	})
}

// orderRequest is the JSON body for POST /v1/orders.
type orderRequest struct {
	MarketID   string `json:"market_id"`
	MarketSlug string `json:"market_slug"` // alternative to market_id
	UserID     string `json:"user_id"`     // required if no JWT
	Outcome    int    `json:"outcome"`
	Side       string `json:"side"`        // "buy" | "sell"
	PriceCents int32  `json:"price_cents"`
	Qty        int64  `json:"qty"`
}

// orderResponse is the JSON returned from a successful order placement.
type orderResponse struct {
	OrderID     string         `json:"order_id"`
	Status      string         `json:"status"` // "open" | "partial" | "filled"
	FilledQty   int64          `json:"filled_qty"`
	RestingQty  int64          `json:"resting_qty"`
	Fills       []fillResponse `json:"fills"`
	Seq         uint64         `json:"seq"`
	MarketID    string         `json:"market_id"`
	MarketSlug  string         `json:"market_slug"`
	Outcome     int            `json:"outcome"`
	Side        string         `json:"side"`
	PriceCents  int32          `json:"price_cents"`
	Qty         int64          `json:"qty"`
}

type fillResponse struct {
	PriceCents   int32  `json:"price_cents"`
	Qty          int64  `json:"qty"`
	MakerOrderID string `json:"maker_order_id"`
}

func (s *Server) handlePlaceOrder(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	traceID := uuid.NewString()
	log := s.Log.With("trace_id", traceID, "route", "POST /v1/orders")

	var req orderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_json", err.Error())
		return
	}

	// Idempotency check.
	idemKey := r.Header.Get("Idempotency-Key")
	if idemKey != "" {
		if cached, ok, err := s.Store.CheckIdempotency(ctx, idemKey); err != nil {
			log.Warn("idem check failed", "err", err)
		} else if ok {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Idempotent-Replay", "true")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(cached)
			return
		}
	}

	// Resolve market.
	var m *match.Market
	if req.MarketID != "" {
		mid, err := uuid.Parse(req.MarketID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_market_id", err.Error())
			return
		}
		m = s.Reg.Get(mid)
	} else if req.MarketSlug != "" {
		m = s.Reg.BySlug(req.MarketSlug)
	}
	if m == nil {
		writeError(w, http.StatusNotFound, "market_not_found", "")
		return
	}

	// Auth (optional in P0 for ease of testing — if header present, verify
	// and require user_id match).
	if s.Verifier != nil {
		if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
			tok := strings.TrimPrefix(auth, "Bearer ")
			uid, err := s.Verifier.Verify(ctx, tok)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "invalid_token", err.Error())
				return
			}
			if req.UserID == "" {
				req.UserID = uid
			} else if req.UserID != uid {
				writeError(w, http.StatusForbidden, "user_mismatch", "")
				return
			}
		}
	}

	uid, err := uuid.Parse(req.UserID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_user_id", err.Error())
		return
	}

	side := book.Bid
	sideStr := strings.ToLower(req.Side)
	switch sideStr {
	case "buy", "bid":
		side = book.Bid
		sideStr = "buy"
	case "sell", "ask":
		side = book.Ask
		sideStr = "sell"
	default:
		writeError(w, http.StatusBadRequest, "bad_side", req.Side)
		return
	}

	orderID := uuid.New()
	if idemKey == "" {
		// fall back to a generated key so the DB row has one
		idemKey = "hcrt_order_" + orderID.String()
	}

	// Persist as 'open' first.
	if err := s.Store.InsertOrder(ctx, store.InsertOrderInput{
		ID:                   orderID,
		ClientIdempotencyKey: idemKey,
		MarketID:             m.ID(),
		UserID:               uid,
		Outcome:              req.Outcome,
		Side:                 store.OrderSide(sideStr),
		PriceCents:           req.PriceCents,
		Qty:                  req.Qty,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "insert_failed", err.Error())
		return
	}

	// Push to WAL before matching so we can replay.
	walEntry := natsx.WALEntry{
		Seq:        0, // filled after match
		Kind:       "order",
		MarketSlug: m.Slug(),
		MarketID:   m.ID().String(),
		OrderID:    orderID.String(),
		UserID:     uid.String(),
		Outcome:    req.Outcome,
		Side:       side.String(),
		PriceCents: req.PriceCents,
		Qty:        req.Qty,
		Ts:         time.Now().UTC(),
	}

	// Match.
	result, err := m.Submit(match.Order{
		ID:         orderID,
		MarketID:   m.ID(),
		UserID:     uid,
		Outcome:    req.Outcome,
		Side:       side,
		PriceCents: req.PriceCents,
		Qty:        req.Qty,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, "submit_failed", err.Error())
		return
	}

	walEntry.Seq = result.Seq
	if s.Bus != nil {
		if err := s.Bus.PublishWAL(ctx, walEntry); err != nil {
			log.Warn("wal publish failed", "err", err)
		}
	}

	// Persist fills + journal lines.
	if len(result.Fills) > 0 {
		records := make([]store.FillRecord, 0, len(result.Fills))
		for _, f := range result.Fills {
			fee, _ := match.CalcFeeCents(f.PriceCents, f.Qty)
			records = append(records, store.FillRecord{
				ID:           uuid.New(),
				MarketID:     m.ID(),
				TakerOrderID: f.TakerOrderID,
				MakerOrderID: f.MakerOrderID,
				TakerUserID:  f.TakerUserID,
				MakerUserID:  f.MakerUserID,
				Outcome:      req.Outcome,
				PriceCents:   f.PriceCents,
				Qty:          f.Qty,
				FeeCents:     fee,
			})
		}
		if err := s.Store.CommitFills(ctx, records); err != nil {
			log.Error("commit fills failed", "err", err)
			writeError(w, http.StatusInternalServerError, "commit_fills_failed", err.Error())
			return
		}
		// Publish trade + fill events.
		s.publishFills(m, req.Outcome, sideStr, result.Fills)
	}

	// Publish updated book snapshot.
	s.publishBook(m, req.Outcome)

	// Build response.
	filledQty := int64(0)
	for _, f := range result.Fills {
		filledQty += f.Qty
	}
	resp := orderResponse{
		OrderID:    orderID.String(),
		Status:     resolveStatus(filledQty, req.Qty, result.RestingQty),
		FilledQty:  filledQty,
		RestingQty: result.RestingQty,
		Seq:        result.Seq,
		MarketID:   m.ID().String(),
		MarketSlug: m.Slug(),
		Outcome:    req.Outcome,
		Side:       sideStr,
		PriceCents: req.PriceCents,
		Qty:        req.Qty,
	}
	for _, f := range result.Fills {
		resp.Fills = append(resp.Fills, fillResponse{
			PriceCents:   f.PriceCents,
			Qty:          f.Qty,
			MakerOrderID: f.MakerOrderID.String(),
		})
	}

	raw, _ := json.Marshal(resp)
	if idemKey != "" {
		if err := s.Store.SaveIdempotency(ctx, idemKey, raw); err != nil {
			log.Warn("save idem failed", "err", err)
		}
	}

	log.Info("order placed",
		"order_id", orderID, "market_id", m.ID(), "side", sideStr,
		"price", req.PriceCents, "qty", req.Qty,
		"filled", filledQty, "resting", result.RestingQty)

	writeJSONRaw(w, http.StatusCreated, raw)
}

func resolveStatus(filled, qty, resting int64) string {
	if filled == 0 {
		if resting > 0 {
			return "open"
		}
		return "cancelled" // self-trade cancelled the whole order
	}
	if filled >= qty {
		return "filled"
	}
	return "partial"
}

func (s *Server) handleCancelOrder(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_id", err.Error())
		return
	}
	// Find market by scanning registry. For a more efficient lookup we'd
	// keep an index in store; M6 scope: linear scan over markets is fine.
	for _, m := range s.Reg.All() {
		if qty, ok := m.Cancel(id); ok {
			if err := s.Store.CancelOrder(ctx, id); err != nil {
				writeError(w, http.StatusInternalServerError, "cancel_db_failed", err.Error())
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{
				"order_id":      id.String(),
				"status":        "cancelled",
				"cancelled_qty": qty,
				"market_id":     m.ID().String(),
			})
			return
		}
	}
	writeError(w, http.StatusNotFound, "order_not_resting", "")
}

func (s *Server) handleBookSnapshot(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("marketId")
	outcomeStr := r.PathValue("outcomeIdx")
	outcome, err := strconv.Atoi(outcomeStr)
	if err != nil || outcome < 0 || outcome >= 5 {
		writeError(w, http.StatusBadRequest, "bad_outcome", "")
		return
	}
	// Accept either market id (uuid) or slug.
	var m *match.Market
	if mid, err := uuid.Parse(idStr); err == nil {
		m = s.Reg.Get(mid)
	} else {
		m = s.Reg.BySlug(idStr)
	}
	if m == nil {
		writeError(w, http.StatusNotFound, "market_not_found", "")
		return
	}
	bids, err := m.Snapshot(outcome, book.Bid, 20)
	if err != nil {
		writeError(w, http.StatusBadRequest, "snap_failed", err.Error())
		return
	}
	asks, _ := m.Snapshot(outcome, book.Ask, 20)
	writeJSON(w, http.StatusOK, map[string]any{
		"market_id":   m.ID().String(),
		"market_slug": m.Slug(),
		"outcome":     outcome,
		"seq":         m.Seq(),
		"bids":        bids.Levels,
		"asks":        asks.Levels,
	})
}

