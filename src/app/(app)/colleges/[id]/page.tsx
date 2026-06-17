"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import CollegeLogo from "@/components/CollegeLogo";
import { supabase } from "@/lib/supabaseBrowser";
import { useAuth } from "@/components/AuthProvider";
import { DETAIL_SECTIONS, GRADES, TARGET, gradeChip, targetChip, yesNoChip } from "@/lib/collegeDetail";

function fmtPct(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return (n <= 1 ? Math.round(n * 100) : n) + "%";
}

export default function CollegeDetail() {
  const params = useParams<{ id: string }>();
  const id = (params?.id as string) || "";
  const { session } = useAuth();
  const [c, setC] = useState<Record<string, any> | null>(null);
  const [missing, setMissing] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cRef = useRef<Record<string, any> | null>(null);
  cRef.current = c;

  useEffect(() => {
    if (!session || !id) return;
    (async () => {
      const res = await supabase().from("colleges").select("*").eq("id", id).maybeSingle();
      if (res.data) setC(res.data as Record<string, any>);
      else setMissing(true);
    })();
  }, [session, id]);

  if (missing) {
    return (
      <>
        <div className="topbar"><div><p className="crumb"><Link href="/colleges">Colleges</Link></p><h1>Not found</h1></div></div>
        <div className="card"><div className="card-b"><div className="empty">That college doesn&apos;t exist. <Link href="/colleges">Back to Colleges →</Link></div></div></div>
      </>
    );
  }
  if (!c) {
    return (
      <>
        <div className="topbar"><div><p className="crumb"><Link href="/colleges">Colleges</Link></p><h1>Loading…</h1></div></div>
        <div className="card"><div className="card-b"><span className="skel skel-row" style={{ width: "70%" }} /></div></div>
      </>
    );
  }

  const setField = (k: string, v: any) => {
    const next = { ...cRef.current, [k]: v };
    setC(next);
    cRef.current = next;
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const { error } = await supabase().from("colleges").update({ [k]: v === "" ? null : v }).eq("id", id);
      setState(error ? "idle" : "saved");
    }, 500);
  };

  return (
    <>
      <div className="topbar">
        <div>
          <p className="crumb"><Link href="/colleges">Colleges</Link> › {c.name}</p>
          <div className="inline-head">
            <CollegeLogo name={c.name || ""} websiteUrl={c.website_url} logoUrl={c.logo_url} size={44} />
            <h1 style={{ margin: 0 }}>{c.name}</h1>
            {c.overall_grade && <span className={"chip " + gradeChip(c.overall_grade)}>Overall {c.overall_grade}</span>}
            {c.target_status && <span className={"chip " + targetChip(c.target_status)}>{c.target_status}</span>}
            {c.acceptance_rate != null && c.acceptance_rate !== "" && <span className="chip dim">{fmtPct(c.acceptance_rate)} accept</span>}
          </div>
        </div>
        <div className="toolbar">
          <span className="muted" style={{ fontSize: 13 }}>{state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : ""}</span>
        </div>
      </div>

      {DETAIL_SECTIONS.map((sec) => (
        <div className="card" key={sec.title}>
          <div className="card-h"><h3>{sec.title}</h3></div>
          <div className="card-b" style={{ paddingTop: 14 }}>
            <div className="form">
              {sec.fields.map((f) => {
                const full = f.type === "long";
                return (
                  <div className={"field" + (full ? " full" : "")} key={f.k}>
                    <label htmlFor={"d-" + f.k}>{f.label}</label>
                    {f.type === "long" ? (
                      <textarea id={"d-" + f.k} value={c[f.k] ?? ""} onChange={(e) => setField(f.k, e.target.value)} style={{ minHeight: 80 }} />
                    ) : f.type === "grade" ? (
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <select id={"d-" + f.k} value={c[f.k] ?? ""} onChange={(e) => setField(f.k, e.target.value)} style={{ maxWidth: 120 }}>
                          <option value="" />
                          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                        {c[f.k] && <span className={"chip " + gradeChip(c[f.k])}>{c[f.k]}</span>}
                      </div>
                    ) : f.type === "target" ? (
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <select id={"d-" + f.k} value={c[f.k] ?? ""} onChange={(e) => setField(f.k, e.target.value)} style={{ maxWidth: 170 }}>
                          <option value="" />
                          {TARGET.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        {c[f.k] && <span className={"chip " + targetChip(c[f.k])}>{c[f.k]}</span>}
                      </div>
                    ) : f.type === "number" ? (
                      <input id={"d-" + f.k} type="number" value={c[f.k] ?? ""} onChange={(e) => setField(f.k, e.target.value === "" ? "" : Number(e.target.value))} />
                    ) : (
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <input id={"d-" + f.k} type="text" value={c[f.k] ?? ""} onChange={(e) => setField(f.k, e.target.value)} />
                        {f.k === "business_major_school" && c[f.k] && (
                          <span className={"chip " + yesNoChip(c[f.k])}>{/^\s*yes/i.test(String(c[f.k])) ? "Yes" : "No"}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
