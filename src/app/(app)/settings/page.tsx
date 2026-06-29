"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabaseBrowser";

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtWhen(s: string | null) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return `${M[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// Google Drive brand mark.
function DriveLogo() {
  return (
    <svg viewBox="0 0 87.3 78" aria-hidden="true">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  );
}

export default function Settings() {
  const { session } = useAuth();
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase()
      .from("app_config")
      .select("google_connected_at")
      .eq("user_id", session.user.id)
      .maybeSingle();
    setConnectedAt((data as any)?.google_connected_at ?? null);
    setChecked(true);
  }, [session]);
  useEffect(() => {
    load();
  }, [load]);

  const note = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("google") : null;

  return (
    <>
      <div className="topbar"><div><h1>Settings</h1></div></div>

      <div className="card">
        <div className="card-h"><h3>Account</h3></div>
        <div className="card-b">
          <dl className="kv">
            <dt>Mode</dt>
            <dd>Private — single user, no sign-in.</dd>
            {session && <><dt>Account</dt><dd>{session.user.email}</dd></>}
            <dt>Storage</dt>
            <dd>Cloud (Supabase) — synced across your devices, protected by row-level security.</dd>
          </dl>
        </div>
      </div>

      <h2 className="set-group">Connections</h2>

      {/* Google Drive */}
      <div className="card">
        <div className="card-h">
          <span className="set-int-title"><span className="set-int-logo"><DriveLogo /></span><h3>Google Drive</h3></span>
          {checked && connectedAt && <span className="chip ok">Connected</span>}
        </div>
        <div className="card-b">
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
            Connect Google Drive so Compass can create your essay Google Docs and file them into your Drive folders (Essays → Personal Statement / Supplementals), shared so your counselor can edit.
          </p>
          {note === "connected" && <div className="chip ok" style={{ marginBottom: 12 }}>Google connected ✓</div>}
          {note === "error" && <div className="chip danger" style={{ marginBottom: 12 }}>Couldn&apos;t connect — try again</div>}
          {!checked ? (
            <span className="skel skel-row" style={{ width: "40%" }} />
          ) : connectedAt ? (
            <dl className="kv">
              <dt>Status</dt>
              <dd>Connected · <a href="/api/google/auth">reconnect</a></dd>
              <dt>Since</dt>
              <dd>{fmtWhen(connectedAt)}</dd>
            </dl>
          ) : (
            <a className="btn primary" href="/api/google/auth">Connect Google Drive</a>
          )}
        </div>
      </div>

      {/* Claude */}
      <div className="card">
        <div className="card-h">
          <span className="set-int-title">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="set-int-wordmark" src="/logos/claude-logo.png" alt="Claude" />
          </span>
          <span className="chip dim">Coming soon</span>
        </div>
        <div className="card-b">
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
            Connect Claude to power AI-assisted brainstorming, supplement feedback, and Narrative-Method guidance — grounded in your profile and activities.
          </p>
          <dl className="kv">
            <dt>Status</dt>
            <dd>Not connected — available in a future update.</dd>
          </dl>
          <button className="btn" disabled title="Claude integration is coming soon">Connect Claude</button>
        </div>
      </div>

      <h2 className="set-group">About</h2>

      <div className="card">
        <div className="card-h"><h3>Compass</h3></div>
        <div className="card-b">
          <dl className="kv">
            <dt>What it is</dt>
            <dd>Your private command center for the whole college-application process.</dd>
            <dt>Source of truth</dt>
            <dd>Records flow from CoWork → validated → here; review and roll back on the Sync page.</dd>
            <dt>Privacy</dt>
            <dd>Your data stays in your own cloud workspace; the Profile page has a privacy blind to hide sensitive fields on screen.</dd>
          </dl>
        </div>
      </div>
    </>
  );
}
