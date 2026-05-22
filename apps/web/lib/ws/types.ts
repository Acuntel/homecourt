// HOMECOURT — Engine WebSocket wire types.
//
// Mirrors the server frames defined in services/engine/internal/api/publish.go
// and services/engine/internal/ws/ws.go. We use a permissive shape because
// the engine adds new fields freely; channel handlers only read what they
// need.

export type WsStatus = "connecting" | "open" | "closed";

export interface ServerMessage {
  type?: string;
  channel?: string;
  market?: string;
  outcome?: number;
  seq?: number;
  bids?: [number, number][];
  asks?: [number, number][];
  price?: number;
  qty?: number;
  side?: "buy" | "sell";
  order_id?: string;
  ts?: string;
  code?: string;
  message?: string;
  data?: Record<string, unknown>;
}

export type ChannelHandler = (msg: ServerMessage) => void;
export type StatusHandler = (status: WsStatus) => void;
