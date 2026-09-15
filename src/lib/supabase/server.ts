import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Use this inside server components and server actions. It forwards the
 * signed-in user's cookies, so every query runs AS that user -- RLS
 * policies apply exactly as they would from the browser. This is the
 * client you want for almost everything.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no write access; safe to
            // ignore if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

/**
 * Service-role client: bypasses RLS entirely. Use ONLY in trusted,
 * server-only code paths (e.g. a background job reconciling settlements
 * across orgs). Never import this into anything reachable from a client
 * component, and never send its result set back to the browser unfiltered.
 */
export function createServiceRoleClient() {
  const { createClient: createSupabaseClient } = require("@supabase/supabase-js");
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
