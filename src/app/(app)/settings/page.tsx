"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabaseBrowser";

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

      <div className="card">
        <div className="card-h"><h3>Google Docs</h3></div>
        <div className="card-b">
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
            Connect your Google account so the site can create supplement Docs in your Drive (shared so your counselor can edit).
          </p>
          {note === "connected" && <div className="chip ok" style={{ marginBottom: 12 }}>Google connected ✓</div>}
          {note === "error" && <div className="chip danger" style={{ marginBottom: 12 }}>Couldn&apos;t connect — try again</div>}
          {!checked ? (
            <span className="skel skel-row" style={{ width: "40%" }} />
          ) : connectedAt ? (
            <dl className="kv">
              <dt>Status</dt>
              <dd>Connected · <a href="/api/google/auth">reconnect</a></dd>
            </dl>
          ) : (
            <a className="btn primary" href="/api/google/auth">Connect Google</a>
          )}
        </div>
      </div>
    </>
  );
}
