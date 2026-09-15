import { createBrowserClient } from "@supabase/ssr";

/**
 * Use this inside client components ("use client"). It reads the anon
 * key, so RLS is what protects the data -- never widen this to the
 * service_role key.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
