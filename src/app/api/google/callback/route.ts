import { NextResponse } from "next/server";
import { serverUserClient } from "@/lib/serverSupabase";

// Google redirects here after consent with ?code= (&state=). Verify the state against the cookie set
// by /api/google/auth (CSRF guard), exchange the code for a refresh token and store it, then send the
// user back to Settings.
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.headers.get("cookie")?.match(/(?:^|;\s*)g_oauth_state=([^;]+)/)?.[1];
  const back = (s: string) => {
    const r = NextResponse.redirect(`${url.origin}/settings?google=${s}`, 302);
    r.cookies.set("g_oauth_state", "", { path: "/", maxAge: 0 }); // clear the one-time state
    return r;
  };
  if (!code) return back("error");
  if (!state || !cookieState || state !== cookieState) return back("error");

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return new Response("Google OAuth not configured", { status: 503 });

  try {
    const tr = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${url.origin}/api/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    const tj = await tr.json();
    if (!tr.ok || !tj.refresh_token) return back("error");

    const { client, userId } = await serverUserClient();
    await client
      .from("app_config")
      .upsert(
        { user_id: userId, google_refresh_token: tj.refresh_token, google_connected_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    return back("connected");
  } catch {
    return back("error");
  }
}
