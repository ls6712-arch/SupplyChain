"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function sendMagicLink(formData: FormData) {
  const email = formData.get("email") as string;
  if (!email) return { error: "Enter an email address." };

  const supabase = await createClient();

  // NEXT_PUBLIC_SITE_URL should be your deployed URL in production
  // (e.g. https://your-app.vercel.app); falls back to localhost for dev.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) return { error: error.message };
  return { success: true };
}
