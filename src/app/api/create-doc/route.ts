import { NextResponse } from "next/server";
import { createSign } from "node:crypto";

// Creates a Google Doc and shares it "anyone with the link = editor", returning its URL.
// Uses a Google service account (env creds) with a hand-rolled RS256 JWT — no googleapis SDK.
// Until the credentials are set, returns 503 so the UI can show a friendly "not configured" message.
export const runtime = "nodejs";

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(email: string, key: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/drive.file",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claim}`;
  const signature = b64url(createSign("RSA-SHA256").update(signingInput).sign(key));
  const assertion = `${signingInput}.${signature}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error_description || j.error || "token exchange failed");
  return j.access_token as string;
}

export async function POST(req: Request) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!email || !key) {
    return NextResponse.json(
      { error: "Google Docs isn't set up yet. Add the service-account credentials in Vercel (see the operating manual), then try again." },
      { status: 503 },
    );
  }
  key = key.replace(/\\n/g, "\n"); // env vars store the PEM with escaped newlines

  let title = "Supplement";
  try {
    const body = await req.json();
    if (body?.title) title = String(body.title).slice(0, 200);
  } catch {
    /* default title */
  }

  try {
    const token = await getAccessToken(email, key);
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
    return NextResponse.json({ error: "Google Docs error: " + (e as Error).message }, { status: 500 });
  }
}
