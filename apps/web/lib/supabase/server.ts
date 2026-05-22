// HOMECOURT — Supabase server-side client.
// Use from Server Components, Server Actions, Route Handlers.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@homecourt/db";

import { supabaseAnonKey, supabaseServiceRoleKey, supabaseUrl } from "./config";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // `setAll` is called from a Server Component — Next forbids cookie
          // mutation outside of a Route Handler / Server Action. The middleware
          // will refresh the session, so it's safe to swallow this error.
        }
      },
    },
  });
}

/**
 * Service-role client — bypasses RLS. Use only from server-side mutations
 * that need to manage tables the user can't normally write to (e.g. provisioning
 * `accounts` + initial `journal` deposit on signup).
 */
export function createServiceClient() {
  return createServerClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // no-op — service-role client never writes cookies.
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
