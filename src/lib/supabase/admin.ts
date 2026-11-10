import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client met de geheime sleutel. Omzeilt RLS, dus alleen voor de server:
 * de pipeline, de Mollie-webhook en de geplande bewaking. Nooit importeren in een clientcomponent.
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
