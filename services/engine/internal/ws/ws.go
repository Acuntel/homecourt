// Package ws implements the engine's WebSocket fanout layer.
//
// Wire protocol (BUILD.md §7):
//
//	C → S: {"type":"subscribe","channels":["orderbook:slug:0","trade:slug","fill:user"]}
//	C → S: {"type":"unsubscribe","channels":["…"]}
//	C → S: {"type":"ping","ts":…}
//
//	S → C: {"type":"snapshot",...}
//	S → C: {"type":"orderbook_delta",...}
//	S → C: {"type":"trade",...}
//	S → C: {"type":"fill",...}
//	S → C: {"type":"market_lifecycle",...}
//	S → C: {"type":"pong","ts":…}
//	S → C: {"type":"error","code":"…","message":"…"}
package ws

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/Acuntel/homecourt/services/engine/internal/auth"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin:     func(_ *http.Request) bool { return true },
}

// Hub fans out engine events to subscribed websocket clients.
type Hub struct {
	log      *slog.Logger
	verifier *auth.Verifier

	mu      sync.RWMutex
	clients map[*Client]struct{}
}

// NewHub returns an empty hub.
func NewHub(log *slog.Logger, verifier *auth.Verifier) *Hub {
	return &Hub{
		log:      log,
		verifier: verifier,
		clients:  make(map[*Client]struct{}),
	}
}

// HandleHTTP is the http.Handler for /v1/ws.
func (h *Hub) HandleHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		// Upgrader already wrote the response.
		return
	}
	c := &Client{
		id:       uuid.NewString(),
		hub:      h,
		conn:     conn,
		send:     make(chan []byte, 256),
		channels: make(map[string]struct{}),
	}

	// Optional auth — token from query or Authorization header.
	if h.verifier != nil {
		tok := r.URL.Query().Get("token")
		if tok == "" {
			if a := r.Header.Get("Authorization"); len(a) > 7 && a[:7] == "Bearer " {
				tok = a[7:]
			}
		}
		if tok != "" {
			uid, err := h.verifier.Verify(r.Context(), tok)
			if err == nil {
				c.userID = uid
			} else {
				h.log.Info("ws auth failed", "err", err)
				_ = conn.WriteJSON(map[string]any{"type": "error", "code": "unauthorized", "message": err.Error()})
				// allow anonymous read-only by NOT closing here.
			}
		}
	}

	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()

	go c.writePump()
	c.readPump()

	h.mu.Lock()
	delete(h.clients, c)
	h.mu.Unlock()
}

// Broadcast sends `payload` to every client subscribed to `channel`.
// For per-user channels ("fill:<userId>"), only matching userID clients
// receive it.
func (h *Hub) Broadcast(channel string, payload []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		c.mu.RLock()
		_, sub := c.channels[channel]
		c.mu.RUnlock()
		if !sub {
			continue
		}
		select {
		case c.send <- payload:
		default:
			// Slow client — drop.
		}
	}
}

// Client is a single connected ws.
type Client struct {
	id       string
	hub      *Hub
	conn     *websocket.Conn
	send     chan []byte
	userID   string

	mu       sync.RWMutex
	channels map[string]struct{}
}

type clientMsg struct {
	Type     string   `json:"type"`
	Channels []string `json:"channels"`
	Ts       int64    `json:"ts,omitempty"`
}

func (c *Client) readPump() {
	defer func() { _ = c.conn.Close(); close(c.send) }()
	c.conn.SetReadLimit(64 * 1024)
	_ = c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	})

	for {
		_, msg, err := c.conn.ReadMessage()
		if err != nil {
			if !errors.Is(err, websocket.ErrCloseSent) {
				c.hub.log.Debug("ws read closed", "id", c.id, "err", err)
			}
			return
		}
		var m clientMsg
		if err := json.Unmarshal(msg, &m); err != nil {
			c.write(map[string]any{"type": "error", "code": "bad_message", "message": err.Error()})
			continue
		}
		switch m.Type {
		case "subscribe":
			c.subscribe(m.Channels)
		case "unsubscribe":
			c.unsubscribe(m.Channels)
		case "ping":
			c.write(map[string]any{"type": "pong", "ts": m.Ts})
		default:
			c.write(map[string]any{"type": "error", "code": "unknown_type", "message": m.Type})
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case msg, ok := <-c.send:
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
				return
			}
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) subscribe(channels []string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, ch := range channels {
		// fill:user — auth required; we transparently pin it to the user.
		if ch == "fill:user" {
			if c.userID == "" {
				c.writeUnlocked(map[string]any{"type": "error", "code": "unauthorized", "message": "fill:user requires auth"})
				continue
			}
			ch = "fill:" + c.userID
		}
		c.channels[ch] = struct{}{}
	}
}

func (c *Client) unsubscribe(channels []string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, ch := range channels {
		if ch == "fill:user" && c.userID != "" {
			ch = "fill:" + c.userID
		}
		delete(c.channels, ch)
	}
}

func (c *Client) write(v any) {
	raw, _ := json.Marshal(v)
	select {
	case c.send <- raw:
	default:
	}
}

func (c *Client) writeUnlocked(v any) {
	// Same as write but caller must already hold c.mu.
	c.write(v)
}

// Shutdown closes all client connections (best-effort, used on engine drain).
func (h *Hub) Shutdown(ctx context.Context) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.clients {
		_ = c.conn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseGoingAway, "engine draining"))
		_ = c.conn.Close()
	}
	_ = ctx
}
