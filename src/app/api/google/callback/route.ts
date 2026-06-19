import { serverUserClient } from "@/lib/serverSupabase";

// Google redirects here after consent with ?code=. Exchange it for a refresh token and store it, then
// send the user back to Settings.
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const back = (s: string) => Response.redirect(`${url.origin}/settings?google=${s}`, 302);
  if (!code) return back("error");

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
