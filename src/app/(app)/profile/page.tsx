"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseBrowser";
import { useAuth } from "@/components/AuthProvider";
import { superscore } from "@/lib/collegeBoard";

type PField = { k: string; label: string; type?: "text" | "number" | "date" };
const FIELDS: PField[] = [
  { k: "full_name", label: "Full name" },
  { k: "preferred_name", label: "Preferred name" },
  { k: "date_of_birth", label: "Date of birth", type: "date" },
  { k: "document_id", label: "Document / ID" },
  { k: "citizenship", label: "Citizenship" },
  { k: "email", label: "Email" },
  { k: "phone", label: "Phone" },
  { k: "address", label: "Street address" },
  { k: "city", label: "City" },
  { k: "state_region", label: "State / region" },
  { k: "zip", label: "ZIP / postal" },
  { k: "country", label: "Country" },
  { k: "high_school", label: "High school" },
  { k: "graduation_year", label: "Graduation year", type: "number" },
  { k: "gpa", label: "GPA" },
  { k: "act", label: "ACT", type: "number" },
  { k: "toefl", label: "TOEFL", type: "number" },
  { k: "parent1_name", label: "Parent / guardian 1" },
  { k: "parent2_name", label: "Parent / guardian 2" },
];

export default function Profile() {
  const { session } = useAuth();
  const [form, setForm] = useState<Record<string, string>>({});
  const [satSuper, setSatSuper] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  if (!session) {
    return (
      <>
        <div className="topbar"><div><h1>Profile</h1></div></div>
        <div className="card"><div className="card-b"><div className="empty">Loading…</div></div></div>
      </>
    );
  }

  const set = (k: string, v: string) => {
    const next = { ...form, [k]: v };
    setForm(next);
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const payload: Record<string, unknown> = { user_id: session.user.id };
      for (const fl of FIELDS) {
        const raw = (next[fl.k] || "").trim();
        if (fl.type === "number") { const n = Number(raw); payload[fl.k] = raw === "" || !Number.isFinite(n) ? null : n; }
        else payload[fl.k] = raw === "" ? null : raw;
      }
      const { error } = await supabase().from("profiles").upsert(payload, { onConflict: "user_id" });
      setState(error ? "idle" : "saved"); // never show a false "Saved" on failure
    }, 600);
  };

  return (
    <>
      <div className="topbar">
        <div><h1>Profile</h1></div>
        <div className="toolbar">
          <span className="muted" style={{ fontSize: 13 }}>{state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : ""}</span>
        </div>
      </div>
      <div className="card">
        <div className="card-b" style={{ paddingTop: 16 }}>
          <div className="form">
            {FIELDS.map((fl) => (
              <div className="field" key={fl.k}>
                <label>{fl.label}</label>
                <input
                  type={fl.type === "number" ? "number" : fl.type === "date" ? "date" : "text"}
                  value={form[fl.k] || ""}
                  onChange={(e) => set(fl.k, e.target.value)}
                />
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
