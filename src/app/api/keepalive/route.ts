import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Daily keep-alive ping (wired to a Vercel cron in vercel.json).
//
// Supabase free-tier projects auto-pause after ~7 days without activity. When that happened the
// whole site went down: the auth middleware stalled on the unreachable database until Vercel killed
// the invocation (MIDDLEWARE_INVOCATION_TIMEOUT -> 504 on every route). The middleware now fails
// open, and this ping keeps the project marked active so it should not pause in the first place.
//
// Deliberately cheap and anonymous: a HEAD-only count with the public anon key. It transfers no row
// data (RLS returns nothing without a session — that's fine, the point is that Postgres served a
// request) and it does not sign in, so it burns no auth rate limit.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ ok: false, error: "supabase env not configured" }, { status: 503 });
  }

  const startedAt = Date.now();
  try {
    const client = createClient(url, anon, { auth: { persistSession: false } });
    const { error } = await client.from("app_config").select("user_id", { head: true, count: "exact" });
    if (error) {
      console.error("[compass] keepalive query failed:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    }
    return NextResponse.json({ ok: true, ms: Date.now() - startedAt });
  } catch (e) {
    console.error("[compass] keepalive unreachable:", (e as Error).message);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
