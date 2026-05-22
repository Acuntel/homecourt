"use client";

// HOMECOURT — WS bootstrap provider.
//
// Responsibilities:
//   - Read the Supabase session on mount + on auth changes, and push the
//     JWT into the EngineWsClient singleton so per-user channels work.
//   - Subscribe to "fill:user" while authenticated so any successful match
//     invalidates react-query caches (balance / portfolio / orderbook).
//
// This component renders no UI — it only wires effects. Mount it inside
// the existing ReactQueryProvider so useQueryClient() is available.

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { getEngineWsClient } from "@/lib/ws/client";

export function WsProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  // Push the Supabase JWT into the WS client whenever auth state changes.
  useEffect(() => {
    const supabase = createClient();
    const client = getEngineWsClient();

    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      client.setToken(data.session?.access_token ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      client.setToken(session?.access_token ?? null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Subscribe to fill:user for the lifetime of the provider. Engine
  // rewrites fill:user → fill:<sub> when authed; for anonymous sessions
  // the engine returns an error which our client logs and ignores.
  useEffect(() => {
    const client = getEngineWsClient();
    const unsub = client.subscribe("fill:user", () => {
      // Any fill = balance + portfolio almost certainly changed. The
      // orderbook query key also gets invalidated even though the live
      // orderbook component itself maintains its own state, because some
      // pages (e.g. portfolio) still rely on SSR snapshots.
      void queryClient.invalidateQueries({ queryKey: ["balance"] });
      void queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      void queryClient.invalidateQueries({ queryKey: ["orderbook"] });
      // Top-holders leaderboard re-renders on every fill in the market.
      void queryClient.invalidateQueries({ queryKey: ["holders"] });
    });
    return unsub;
  }, [queryClient]);

  return <>{children}</>;
}
