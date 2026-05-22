// HOMECOURT — typed server actions via next-safe-action v7.
// Two clients: `action` (anon) and `authAction` (requires a Supabase session).

import { createSafeActionClient } from "next-safe-action";

import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

export const action = createSafeActionClient({
  handleServerError(e) {
    log.error({ err: e.message }, "safe-action server error");
    return e.message;
  },
});

export const authAction = createSafeActionClient({
  handleServerError(e) {
    log.error({ err: e.message }, "safe-action server error");
    return e.message;
  },
}).use(async ({ next }) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("unauthorized");
  }
  return next({ ctx: { user, supabase } });
});
