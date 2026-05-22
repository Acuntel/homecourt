// HOMECOURT — module-level singleton getter for the EngineWsClient.
//
// We attach the instance to globalThis so it survives Fast Refresh in dev
// (otherwise every edit would leak an open connection). The URL is re-read
// from NEXT_PUBLIC_ENGINE_WS_URL on each access so hot-reload of env vars
// is honored without a hard page refresh.

import { EngineWsClient } from "./client";

declare global {
  // eslint-disable-next-line no-var
  var __homecourtWsClient: EngineWsClient | undefined;
}

function defaultUrl(): string {
  return process.env.NEXT_PUBLIC_ENGINE_WS_URL ?? "ws://localhost:8080/v1/ws";
}

export function getEngineWsClient(): EngineWsClient {
  if (typeof window === "undefined") {
    // On the server we still return a stub-like instance so callers can
    // construct hooks without crashing during SSR. connect() early-returns
    // when window is undefined so no socket is ever opened.
    return new EngineWsClient(defaultUrl());
  }
  if (!globalThis.__homecourtWsClient) {
    globalThis.__homecourtWsClient = new EngineWsClient(defaultUrl());
  } else {
    globalThis.__homecourtWsClient.setUrl(defaultUrl());
  }
  return globalThis.__homecourtWsClient;
}
