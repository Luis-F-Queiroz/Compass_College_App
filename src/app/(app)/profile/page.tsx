"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseBrowser";
import { useAuth } from "@/components/AuthProvider";
import { superscore } from "@/lib/collegeBoard";

// `sensitive: true` = masked by the privacy blind (PII / contact / ID / home address / guardians).
// Academic stats and basic identity (name, citizenship, GPA, year, scores) stay visible.
type PField = { k: string; label: string; type?: "text" | "number" | "date"; sensitive?: boolean };
const FIELDS: PField[] = [
  { k: "full_name", label: "Full name" },
  { k: "preferred_name", label: "Preferred name" },
  { k: "date_of_birth", label: "Date of birth", type: "date", sensitive: true },
  { k: "document_id", label: "Document / ID", sensitive: true },
  { k: "citizenship", label: "Citizenship" },
  { k: "email", label: "Email", sensitive: true },
  { k: "phone", label: "Phone", sensitive: true },
  { k: "address", label: "Street address", sensitive: true },
  { k: "city", label: "City", sensitive: true },
  { k: "state_region", label: "State / region" },
  { k: "zip", label: "ZIP / postal", sensitive: true },
  { k: "country", label: "Country" },
  { k: "high_school", label: "High school" },
  { k: "graduation_year", label: "Graduation year", type: "number" },
  { k: "gpa", label: "GPA" },
  { k: "act", label: "ACT", type: "number" },
  { k: "toefl", label: "TOEFL", type: "number" },
  { k: "parent1_name", label: "Parent / guardian 1", sensitive: true },
  { k: "parent2_name", label: "Parent / guardian 2", sensitive: true },
];

export default function Profile() {
  const { session } = useAuth();
  const [form, setForm] = useState<Record<string, string>>({});
  const [satSuper, setSatSuper] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<Record<string, string>>({});
  formRef.current = form;
  const pending = useRef(false);
  const [blind, setBlind] = useState(false); // master privacy "blind" — masks sensitive values (display only)

  useEffect(() => {
    if (!session) return;
    (async () => {
      const sb = supabase();
      const [res, sit] = await Promise.all([
        sb.from("profiles").select("*").eq("user_id", session.user.id).maybeSingle(),
        sb.from("sat_sittings").select("rw,math"),
      ]);
      const d = res.data as Record<string, unknown> | null;
      if (d) {
        const f: Record<string, string> = {};
        for (const fl of FIELDS) f[fl.k] = d[fl.k] == null ? "" : String(d[fl.k]);
        setForm(f);
      }
      setSatSuper(superscore((sit.data as { rw: number | null; math: number | null }[]) ?? []).total);
    })();
  }, [session]);

  // Remember the privacy-blind preference across visits (presentation-only; never affects saved data).
  useEffect(() => {
    try { setBlind(localStorage.getItem("compass_profile_blind") === "1"); } catch { /* localStorage unavailable */ }
  }, []);

  if (!session) {
    return (
      <>
        <div className="topbar"><div><h1>Profile</h1></div></div>
        <div className="card"><div className="card-b"><div className="empty">Loading…</div></div></div>
      </>
    );
  }

  // Persist the latest form. Reads formRef so it can also flush on unmount.
  const persist = useCallback(async () => {
    if (!session) return;
    pending.current = false;
    const payload: Record<string, unknown> = { user_id: session.user.id };
    for (const fl of FIELDS) {
      const raw = (formRef.current[fl.k] || "").trim();
      if (fl.type === "number") { const n = Number(raw); payload[fl.k] = raw === "" || !Number.isFinite(n) ? null : n; }
      else payload[fl.k] = raw === "" ? null : raw;
    }
    const { error } = await supabase().from("profiles").upsert(payload, { onConflict: "user_id" });
    setState(error ? "error" : "saved"); // error stays visible until the next successful save
    if (!error) setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 1500);
  }, [session]);

  const set = (k: string, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    pending.current = true;
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(persist, 600);
  };

  const toggleBlind = () => setBlind((b) => {
    const n = !b;
    try { localStorage.setItem("compass_profile_blind", n ? "1" : "0"); } catch { /* ignore */ }
    return n;
  });

  // Warn before leaving with an unsaved edit, and flush the pending save on unmount.
  useEffect(() => {
    const onBU = (e: BeforeUnloadEvent) => { if (pending.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", onBU);
    return () => {
      window.removeEventListener("beforeunload", onBU);
      if (timer.current) clearTimeout(timer.current);
      if (pending.current) persist();
    };
  }, [persist]);

  return (
    <>
      <div className="topbar">
        <div><h1>Profile</h1></div>
        <div className="toolbar">
          <button className="btn" onClick={toggleBlind} aria-pressed={blind} title={blind ? "Show sensitive info" : "Hide sensitive info"}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
                {blind && <path d="M3 3l18 18" />}
              </svg>
              {blind ? "Show info" : "Hide info"}
            </span>
          </button>
          <span className="muted" style={{ fontSize: 13, color: state === "error" ? "var(--danger)" : undefined }}>{state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : state === "error" ? "Save failed — keep editing to retry" : ""}</span>
        </div>
      </div>
      <div className="card">
        <div className="card-b" style={{ paddingTop: 16 }}>
          <div className="form">
            {FIELDS.map((fl) => (
              <div className="field" key={fl.k}>
                <label>{fl.label}</label>
                {blind && fl.sensitive ? (
                  <div className="field-masked" title="Hidden — turn the blind off to reveal" aria-label={`${fl.label}: hidden`}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                    <span className="field-masked-dots">••••••••</span>
                  </div>
                ) : (
                  <input
                    type={fl.type === "number" ? "number" : fl.type === "date" ? "date" : "text"}
                    value={form[fl.k] || ""}
                    onChange={(e) => set(fl.k, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="prof-super">
            <div><span className="prof-super-n">{satSuper ?? "—"}</span> <span className="prof-super-l">SAT superscore</span></div>
            <Link className="btn-sm" href="/college-board">Manage SAT &amp; AP scores →</Link>
          </div>
          <div className="brandrow">
            <a className="brandbtn" href="https://account.collegeboard.org/login/" target="_blank" rel="noopener">College Board</a>
            <a className="brandbtn" href="https://satsuite.collegeboard.org/sat/scores/sending-scores" target="_blank" rel="noopener">Send SAT scores</a>
          </div>
        </div>
      </div>
    </>
  );
}
