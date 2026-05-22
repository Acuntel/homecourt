// HOMECOURT — re-export the Supabase server client + Database typings.
// Most server-side code imports DB types from here for consistency.

import type { Database, Tables, TablesInsert, TablesUpdate, Enums } from "@homecourt/db";

export { createClient, createServiceClient } from "@/lib/supabase/server";
export type { Database, Tables, TablesInsert, TablesUpdate, Enums };
