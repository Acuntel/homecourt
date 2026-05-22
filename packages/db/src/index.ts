// HOMECOURT @homecourt/db — re-exports the generated Supabase Database type
// plus a few convenience aliases that downstream packages can import.

import type { Database } from "./types";

export type { Database, Json } from "./types";

// Convenience aliases for row / insert / update types per table.
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
