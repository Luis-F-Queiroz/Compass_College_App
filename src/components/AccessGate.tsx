"use client";
import { useEffect, useState } from "react";

// First-visit access gate. A device that hasn't entered the code sees a code screen; entering the
// code unlocks and is remembered (localStorage) so the same browser isn't asked again. A new device
// or cleared storage re-prompts. NOTE: this is a light client-side gate (a shared access code), not
// encryption-grade security — the code lives in the browser bundle and the app auto-signs-in to the
// single account, so anyone who enters the code has full access to the data.
const KEY = "compass_access";
const CODE = "2028";

export default function AccessGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "locked" | "open">("checking");
  const [code, setCode] = useState("");
  const [err, setErr] = useState(false);

  useEffect(() => {
    let granted = false;
    try {
      granted = localStorage.getItem(KEY) === "granted";
    } catch {
      granted = false;
    }
    setState(granted ? "open" : "locked");
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim() === CODE) {
      try {
        localStorage.setItem(KEY, "granted");
      } catch {
        /* private mode: still let them in for this session */
      }
      setState("open");
    } else {
      setErr(true);
    }
  };

  if (state === "checking") return null; // avoid a flash of the app before we know
  if (state === "open") return <>{children}</>;

  return (
    <div className="gate">
      <form className="gate-card" onSubmit={submit}>
        <span aria-hidden className="gate-mark">
          <svg viewBox="0 0 32 32" width="44" height="44">
            <rect width="32" height="32" rx="9" fill="#0066cc" />
            <path d="M16 5 L19.2 16 L16 27 L12.8 16 Z" fill="#fff" />
            <path d="M5 16 L16 12.8 L27 16 L16 19.2 Z" fill="#fff" fillOpacity="0.5" />
          </svg>
        </span>
        <h1 className="gate-title">Compass</h1>
        <p className="gate-sub">Enter the access code to continue.</p>
        <input
          className="gate-input"
          inputMode="numeric"
          autoFocus
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setErr(false);
          }}
          placeholder="Access code"
          aria-label="Access code"
          aria-invalid={err}
        />
        {err && <div className="gate-err">That code isn’t right. Try again.</div>}
        <button className="btn primary gate-btn" type="submit">Enter</button>
      </form>
    </div>
  );
}
