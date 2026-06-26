import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

// Starts the Google OAuth consent flow. Visiting this route redirects to Google; after the user
// approves, Google redirects back to /api/google/callback with a code. A random `state` is set in
// an httpOnly cookie and echoed in the URL so the callback can reject forged/cross-site requests.
export const runtime = "nodejs";

export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return new Response(
      "Google OAuth isn't configured. Set GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET in Vercel (see the operating manual).",
      { status: 503 },
    );
  }
  const u = new URL(req.url);
  const state = randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${u.origin}/api/google/callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive",
    access_type: "offline", // request a refresh token
    prompt: "consent", // force a refresh token every time
    include_granted_scopes: "true",
    state,
  });
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, 302);
  res.cookies.set("g_oauth_state", state, { httpOnly: true, secure: u.protocol === "https:", sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
