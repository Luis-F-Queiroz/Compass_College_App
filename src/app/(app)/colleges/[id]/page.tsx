"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import CollegeLogo from "@/components/CollegeLogo";
import { supabase } from "@/lib/supabaseBrowser";
import { useAuth } from "@/components/AuthProvider";
import { DETAIL_SECTIONS, gradeChip, targetChip } from "@/lib/collegeDetail";

// Read-only research view. The Learn More fields are maintained in CoWork / the database, NOT edited
// here — this page only displays them.
function fmtPct(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n + "%";
}
function isEmpty(v: any) {
  return v === null || v === undefined || v === "";
}

export default function CollegeDetail() {
  const params = useParams<{ id: string }>();
  const id = (params?.id as string) || "";
  const { session } = useAuth();
  const [c, setC] = useState<Record<string, any> | null>(null);
  const [missing, setMissing] = useState(false);

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

  const hasResearch = DETAIL_SECTIONS.some((s) => s.fields.some((f) => !isEmpty(c[f.k])));

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
            {!isEmpty(c.acceptance_rate) && <span className="chip dim">{fmtPct(c.acceptance_rate)} accept</span>}
          </div>
        </div>
        <div className="toolbar">
          <span className="muted" style={{ fontSize: 13 }}>Read-only · maintained in CoWork</span>
        </div>
      </div>

      {!hasResearch && (
        <div className="card"><div className="card-b"><div className="empty"><div className="big">No research yet</div>This college&apos;s Learn More is filled in through CoWork.</div></div></div>
      )}

      {DETAIL_SECTIONS.map((sec) => (
        <div className="card" key={sec.title}>
          <div className="card-h"><h3>{sec.title}</h3></div>
          <div className="card-b" style={{ paddingTop: 14 }}>
            <div className="form">
              {sec.fields.map((f) => {
                const val = c[f.k];
                const full = f.type === "long";
                return (
                  <div className={"field" + (full ? " full" : "")} key={f.k}>
                    <label>{f.label}</label>
                    {isEmpty(val) ? (
                      <span className="muted ro-val">—</span>
                    ) : f.type === "long" ? (
                      <div className="ro-text">{String(val)}</div>
                    ) : f.type === "grade" ? (
                      <span><span className={"chip " + gradeChip(val)}>{String(val)}</span></span>
                    ) : f.type === "target" ? (
                      <span><span className={"chip " + targetChip(val)}>{String(val)}</span></span>
                    ) : f.type === "percent" ? (
                      <span className="ro-val">{fmtPct(val)}</span>
                    ) : f.type === "number" ? (
                      <span className="ro-val">#{String(val)}</span>
                    ) : (
                      <span className="ro-val">{String(val)}</span>
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
