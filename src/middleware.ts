import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Single-user mode: silently sign the app in as the one owner account so there is
 * no login screen. The credentials live in server-only env vars (never shipped to
 * the browser). To re-enable real per-user sign-in later, remove the auto-sign-in
 * block below and route unauthenticated users to /login — the rest of the auth
 * stack (RLS, user_id, AuthProvider, /login) is already in place.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { session } } = await supabase.auth.getSession(); // local cookie check — no network when already signed in
  if (!session && process.env.SINGLE_USER_EMAIL && process.env.SINGLE_USER_PASSWORD) {
    const { error } = await supabase.auth.signInWithPassword({
      email: process.env.SINGLE_USER_EMAIL,
      password: process.env.SINGLE_USER_PASSWORD,
    });
    if (error) console.error("[compass] auto sign-in failed:", error.message);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/).*)"],
};
