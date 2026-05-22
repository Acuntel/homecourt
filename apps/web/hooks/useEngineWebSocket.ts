"use client";

// HOMECOURT — React hook over the EngineWsClient singleton.
//
// Components use this hook to:
//   - read the current connection status (for "Live" pulse dots)
//   - subscribe to a channel for the lifetime of an effect
//
// The hook is intentionally minimal: subscriptions are managed by the
// caller via the returned `subscribe()` function (typically inside a
// useEffect). The underlying singleton handles reconnect / backoff /
// ping / backpressure.

import { useCallback, useEffect, useState } from "react";

import { getEngineWsClient, type ChannelHandler, type WsStatus } from "@/lib/ws/client";

export interface UseEngineWebSocket {
  status: WsStatus;
  subscribe: (channel: string, handler: ChannelHandler) => () => void;
}

export function useEngineWebSocket(): UseEngineWebSocket {
  const [status, setStatus] = useState<WsStatus>("closed");

  useEffect(() => {
    const client = getEngineWsClient();
    const unsub = client.onStatus((next) => setStatus(next));
    return unsub;
  }, []);

  const subscribe = useCallback((channel: string, handler: ChannelHandler) => {
    const client = getEngineWsClient();
    return client.subscribe(channel, handler);
  }, []);

  return { status, subscribe };
}
