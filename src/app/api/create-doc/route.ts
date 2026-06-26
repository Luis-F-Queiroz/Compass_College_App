import { NextResponse } from "next/server";
import { serverUserClient } from "@/lib/serverSupabase";

// Creates a Google Doc in the connected user's Drive, files it into the right Essays subfolder
// (Essays/Personal Statement, or Essays/Supplementals/<school>), shares it "anyone with the link =
// editor", and returns its URL. Uses the OAuth refresh token saved by the /api/google/* connect
// flow — which must have full-Drive scope so the user's hand-made folders are visible.
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

// Escape a value for a Drive `q` search string (backslashes + single quotes).
const escQ = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function findFolder(token: string, name: string, parentId?: string): Promise<{ id: string; name: string } | null> {
  let q = `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${escQ(name)}'`;
  if (parentId) q += ` and '${parentId}' in parents`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive&pageSize=10`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || "Drive search failed");
  const files = (j.files ?? []) as { id: string; name: string }[];
  return files[0] ?? null;
}

async function ensureFolder(token: string, name: string, parentId: string): Promise<{ id: string; name: string }> {
  const found = await findFolder(token, name, parentId);
  if (found) return found;
  const r = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  const j = await r.json();
  if (!r.ok || !j.id) throw new Error(j.error?.message || "could not create folder");
  return { id: j.id as string, name: (j.name as string) ?? name };
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
  let kind: "supplement" | "personal_statement" = "supplement";
  let school = "";
  try {
    const body = await req.json();
    if (body?.title) title = String(body.title).slice(0, 200);
    if (body?.kind === "personal_statement") kind = "personal_statement";
    if (body?.school) school = String(body.school).slice(0, 120);
  } catch {
    /* defaults */
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

    // Resolve the destination folder inside the user's "Essays" structure.
    const essays = await findFolder(token, "Essays");
    if (!essays) {
      return NextResponse.json(
        { error: "Couldn't find your 'Essays' folder in Drive. Reconnect Google in Settings — full-Drive access is required so Compass can see the folders you created." },
        { status: 422 },
      );
    }
    let parentId: string;
    if (kind === "personal_statement") {
      const ps = await findFolder(token, "Personal Statement", essays.id);
      if (!ps) {
        return NextResponse.json({ error: "Couldn't find a 'Personal Statement' folder inside 'Essays'. Create it and try again." }, { status: 422 });
      }
      parentId = ps.id;
    } else {
      const supp = await findFolder(token, "Supplementals", essays.id);
      if (!supp) {
        return NextResponse.json({ error: "Couldn't find a 'Supplementals' folder inside 'Essays'. Create it and try again." }, { status: 422 });
      }
      // One folder per school, created on demand.
      const schoolFolder = await ensureFolder(token, school || "Other", supp.id);
      parentId = schoolFolder.id;
    }

    const cr = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: title, mimeType: "application/vnd.google-apps.document", parents: [parentId] }),
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
