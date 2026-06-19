import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase client signed in as the single user, for API routes that need RLS-scoped DB
// access (the OAuth token store). Reads the same SINGLE_USER_* env vars the middleware uses — no
// service-role key needed. Throws if the env isn't configured.
export async function serverUserClient(): Promise<{ client: SupabaseClient; userId: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.SINGLE_USER_EMAIL;
  const password = process.env.SINGLE_USER_PASSWORD;
  if (!url || !anon || !email || !password) throw new Error("server auth env not configured");
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error("server auth failed");
  return { client, userId: data.user.id };
}
