// HOMECOURT — Supabase browser (client component) client.
// Use from "use client" components only.

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@homecourt/db";

import { supabaseAnonKey, supabaseUrl } from "./config";

export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}
