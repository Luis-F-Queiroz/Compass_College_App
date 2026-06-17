"use client";
import { useAuth } from "@/components/AuthProvider";

export default function Settings() {
  const { session } = useAuth();
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
    </>
  );
}
