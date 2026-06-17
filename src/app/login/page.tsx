"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";

export default function Login() {
  const [email, setEmail] = useState(process.env.NEXT_PUBLIC_ALLOWED_EMAIL || "");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await supabase().auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    router.push("/dashboard");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <form onSubmit={signIn} className="card" style={{ maxWidth: 380, width: "100%" }}>
        <div className="card-b" style={{ padding: "28px 26px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18 }}>
            <svg viewBox="0 0 32 32" width="30" height="30">
              <rect width="32" height="32" rx="7" fill="#0066cc" />
              <path d="M16 5 L19.2 16 L16 27 L12.8 16 Z" fill="#fff" />
              <path d="M5 16 L16 12.8 L27 16 L16 19.2 Z" fill="#fff" fillOpacity="0.5" />
            </svg>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>Compass</div>
              <div className="muted" style={{ fontSize: 13 }}>Sign in</div>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Password</label>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
          </div>
          <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={busy} type="submit">
            {busy ? "Signing in…" : "Sign in"}
          </button>
          {msg && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 12 }}>{msg}</div>}
          <div className="muted" style={{ fontSize: 12.5, marginTop: 14, lineHeight: 1.4 }}>
            First time? Confirm your account from the Supabase email, then sign in.
          </div>
        </div>
      </form>
    </div>
  );
}
