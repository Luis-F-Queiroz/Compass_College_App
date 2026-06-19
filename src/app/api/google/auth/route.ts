// Starts the Google OAuth consent flow. Visiting this route redirects to Google; after the user
// approves, Google redirects back to /api/google/callback with a code.
export const runtime = "nodejs";

export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return new Response(
      "Google OAuth isn't configured. Set GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET in Vercel (see the operating manual).",
      { status: 503 },
    );
  }
  const origin = new URL(req.url).origin;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/google/callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.file",
    access_type: "offline", // request a refresh token
    prompt: "consent", // force a refresh token every time
    include_granted_scopes: "true",
  });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, 302);
}
