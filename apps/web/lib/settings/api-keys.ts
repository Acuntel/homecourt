// HOMECOURT — load the P0 "API key" stubs that we squirrel away
// inside the notifications table (kind=deposit, payload.stub=true).

import "server-only";

import { createServiceClient } from "@/lib/supabase/server";

export interface ApiKeyStub {
  id: string;
  name: string;
  last4: string;
  createdAt: string;
}

interface ApiKeyPayload {
  api_key_name?: string;
  api_key_last4?: string;
  api_key_created_at?: string;
  stub?: boolean;
}

export async function loadApiKeyStubs(userId: string): Promise<ApiKeyStub[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("notifications")
    .select("id, payload, created_at")
    .eq("user_id", userId)
    .eq("kind", "deposit")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !data) return [];

  return data
    .map((row) => {
      const payload = row.payload as ApiKeyPayload | null;
      if (!payload?.stub || !payload.api_key_name || !payload.api_key_last4) return null;
      return {
        id: row.id,
        name: payload.api_key_name,
        last4: payload.api_key_last4,
        createdAt: payload.api_key_created_at ?? row.created_at,
      } satisfies ApiKeyStub;
    })
    .filter((k): k is ApiKeyStub => k !== null);
}
