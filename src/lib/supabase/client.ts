import { createBrowserClient } from "@supabase/ssr";
import { publicSupabaseConfig } from "@/lib/supabase/env";

export function createClient() {
  const config = publicSupabaseConfig();
  if (!config) {
    throw new Error("Supabase is not configured. Add the project URL and publishable key, or use demo mode.");
  }
  return createBrowserClient(config.url, config.key);
}
