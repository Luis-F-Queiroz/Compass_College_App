"use client";
/* Read-only Scholarships page: scholarship / financial-aid deadlines, joined to their school.
   Maintained in CoWork (a SyncEntity); every row is tied to a college (college_id is NOT NULL). */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";
import { useAuth } from "@/components/AuthProvider";

type Sch = { id: string; label: string | null; date: string | null; notes: string | null; college_id: string };

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmt(s: string | null) {
  if (!s) return "—";
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(s);
  return `${M[+m[2] - 1]} ${+m[3]}, ${m[1]}`;
}

export default function Scholarships() {
  const { session } = useAuth();
  const [rows, setRows] = useState<Sch[]>([]);
  const [colleges, setColleges] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const sb = supabase();
    const [s, c] = await Promise.all([
      sb.from("scholarship_deadlines").select("id,label,date,notes,college_id").eq("archived", false),
      sb.from("colleges").select("id,name"),
    ]);
    const cmap: Record<string, string> = {};
    for (const col of ((c.data as { id: string; name: string }[]) ?? [])) cmap[col.id] = col.name;
    const list = ((s.data as Sch[]) ?? []).sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
    setColleges(cmap);
    setRows(list);
    setLoading(false);
  }, [session]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Scholarships</h1>
          <p className="crumb">Scholarship &amp; financial-aid deadlines, by school.</p>
        </div>
        <div className="toolbar">
          <span className="muted" style={{ fontSize: 13 }}>Read-only · maintained in CoWork</span>
        </div>
      </div>

      <div className="card">
        <div className="card-b" style={{ paddingTop: 10 }}>
          {loading ? (
            <div aria-busy="true">
              {[0, 1, 2].map((i) => <span key={i} className="skel skel-row" style={{ width: i % 2 ? "60%" : "80%" }} />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="empty">
              <div className="big">No scholarship deadlines yet</div>
              These arrive from CoWork as they&apos;re researched.
            </div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>School</th><th>Scholarship</th><th>Deadline</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td><span className="strong">{colleges[r.college_id] ?? "—"}</span></td>
                      <td>{r.label || <span className="muted">—</span>}</td>
                      <td className="nowrap">{fmt(r.date)}</td>
                      <td>{r.notes || <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
