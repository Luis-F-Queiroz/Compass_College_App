import { NextResponse } from "next/server";
import { serverUserClient } from "@/lib/serverSupabase";

// Creates a Google Doc in the connected user's Drive and shares it "anyone with the link = editor",
// returning its URL. Uses the OAuth refresh token saved by the /api/google/* connect flow.
// Returns a friendly 503 until Google is connected, so the UI can guide the user.
export const runtime = "nodejs";

async function accessTokenFromRefresh(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) throw new Error(j.error_description || j.error || "token refresh failed");
  return j.access_token as string;
}

export async function POST(req: Request) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Google isn't set up yet. Add the OAuth credentials in Vercel (see the operating manual)." },
      { status: 503 },
    );
  }

  let title = "Supplement";
  try {
    const body = await req.json();
    if (body?.title) title = String(body.title).slice(0, 200);
  } catch {
    /* default title */
  }

  try {
    const { client, userId } = await serverUserClient();
    if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const { data: cfg } = await client
      .from("app_config")
      .select("google_refresh_token")
      .eq("user_id", userId)
      .maybeSingle();
    const refresh = (cfg as { google_refresh_token?: string } | null)?.google_refresh_token;
    if (!refresh) {
      return NextResponse.json(
        { error: "Connect your Google account first: Settings → Connect Google." },
        { status: 503 },
      );
    }

    const token = await accessTokenFromRefresh(clientId, clientSecret, refresh);

    const cr = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: title, mimeType: "application/vnd.google-apps.document" }),
    });
    const cj = await cr.json();
    if (!cr.ok || !cj.id) throw new Error(cj.error?.message || "could not create the document");

    // share: anyone with the link can edit
    await fetch(`https://www.googleapis.com/drive/v3/files/${cj.id}/permissions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "writer", type: "anyone" }),
    });

    return NextResponse.json({ url: `https://docs.google.com/document/d/${cj.id}/edit` });
  } catch (e) {
    console.error("create-doc failed:", (e as Error).message);
    return NextResponse.json({ error: "Google Docs error: " + (e as Error).message }, { status: 500 });
  }
}
