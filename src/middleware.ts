import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Never let a slow or unreachable Supabase take the whole site down. Every auth call here is
// bounded by this budget; if it is exceeded (or the call throws) the middleware "fails open" and
// serves the page unauthenticated instead of hanging until Vercel kills the invocation with
// MIDDLEWARE_INVOCATION_TIMEOUT (a 504 on every route). Normal auth round-trips are <500ms.
const AUTH_BUDGET_MS = 5000;

async function withBudget<T>(work: Promise<T>, label: string): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          console.error(`[compass] ${label} exceeded ${AUTH_BUDGET_MS}ms — serving unauthenticated`);
          resolve(null);
        }, AUTH_BUDGET_MS);
      }),
    ]);
  } catch (e) {
    console.error(`[compass] ${label} failed:`, (e as Error).message);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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

  // local cookie check — no network when already signed in, but can refresh over the network
  const sessionResult = await withBudget(supabase.auth.getSession(), "getSession");
  const session = sessionResult?.data.session ?? null;

  if (!session && process.env.SINGLE_USER_EMAIL && process.env.SINGLE_USER_PASSWORD) {
    const signIn = await withBudget(
      supabase.auth.signInWithPassword({
        email: process.env.SINGLE_USER_EMAIL,
        password: process.env.SINGLE_USER_PASSWORD,
      }),
      "auto sign-in",
    );
    if (signIn?.error) console.error("[compass] auto sign-in failed:", signIn.error.message);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/).*)"],
};
