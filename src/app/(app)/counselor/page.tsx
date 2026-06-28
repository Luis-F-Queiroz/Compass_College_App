"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";
import { useAuth } from "@/components/AuthProvider";
import { superscore } from "@/lib/collegeBoard";

type Report = {
  id: string;
  title: string | null;
  period_label: string | null;
  meeting_at: string | null;
  summary: string | null;
  wins: string | null;
  whats_next: string | null;
  through_line: string | null;
  published_at: string;
};

type Snap = {
  gradYear: number | null;
  sat: number | null;
  gpa: string;
  colleges: number;
  activities: number;
  competitions: number;
  upcoming: { label: string; when: string }[];
};

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmt(s: string | null) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return `${M[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function daysUntil(s?: string | null): number | null {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  const t = new Date();
  const t0 = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((d.getTime() - t0.getTime()) / 86400000);
}
function shortDate(s: string) {
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${M[+m[2] - 1]} ${+m[3]}` : String(s);
}

export default function CounselorReports() {
  const { session } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // print-only identity header; defaults to the known values, overridden by the profile if present
  const [student, setStudent] = useState({ name: "Luis Queiroz", email: "luisqueiroz236@gmail.com", grade: "Class of 2028" });
  const [snap, setSnap] = useState<Snap | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const sb = supabase();
    const [rep, prof, sat, col, act, comp, tsk] = await Promise.all([
      sb.from("counselor_reports").select("*").order("published_at", { ascending: false }),
      sb.from("profiles").select("full_name,preferred_name,email,graduation_year,gpa").eq("user_id", session.user.id).maybeSingle(),
      sb.from("sat_sittings").select("rw,math"),
      sb.from("colleges").select("name,deadline").eq("archived", false),
      sb.from("activities").select("id").eq("archived", false),
      sb.from("competitions").select("id").eq("archived", false),
      sb.from("tasks").select("title,due_date,status").eq("archived", false),
    ]);

    setReports((rep.data as Report[]) ?? []);
    const p = prof.data as { full_name?: string; preferred_name?: string; email?: string; graduation_year?: number; gpa?: string } | null;
    if (p) setStudent({
      name: p.full_name || p.preferred_name || "Luis Queiroz",
      email: p.email || "luisqueiroz236@gmail.com",
      grade: p.graduation_year ? `Class of ${p.graduation_year}` : "Class of 2028",
    });

    // "At a glance" snapshot (screen-only)
    const ss = superscore((sat.data as any[]) ?? []);
    const items: { label: string; days: number; date: string }[] = [];
    for (const c of (col.data as any[]) ?? []) {
      const n = daysUntil(c.deadline);
      if (n != null && n >= 0) items.push({ label: `${c.name} — Application`, days: n, date: c.deadline });
    }
    for (const t of (tsk.data as any[]) ?? []) {
      if (t.status === "Done") continue;
      const n = daysUntil(t.due_date);
      if (n != null && n >= 0) items.push({ label: String(t.title), days: n, date: t.due_date });
    }
    items.sort((a, b) => a.days - b.days);
    setSnap({
      gradYear: p?.graduation_year ?? null,
      sat: ss.total ?? null,
      gpa: p?.gpa || "",
      colleges: ((col.data as any[]) ?? []).length,
      activities: ((act.data as any[]) ?? []).length,
      competitions: ((comp.data as any[]) ?? []).length,
      upcoming: items.slice(0, 4).map((i) => ({ label: i.label, when: shortDate(i.date) })),
    });

    setLoading(false);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const current = reports.find((r) => r.id === selectedId) ?? reports[0] ?? null;

  return (
    <>
      <div className="topbar no-print">
        <div>
          <h1>Reports for Counselor</h1>
          <p className="crumb">A short, current snapshot of what Luis has been working on — for his college counselor.</p>
        </div>
        {current && (
          <div className="toolbar">
            <button className="btn" onClick={() => window.print()}>Print / Save PDF</button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card"><div className="card-b"><span className="skel skel-row" style={{ width: "70%" }} /></div></div>
      ) : !current ? (
        <div className="card"><div className="card-b"><div className="empty"><div className="big">No report yet</div>The first counselor update will appear here once CoWork generates it.</div></div></div>
      ) : (
        <div className="counselor-main">
          <div className="card printable report-doc">
            <div className="card-b" style={{ padding: "30px 34px" }}>
              {/* shown only in the printed / saved-PDF report, never on screen */}
              <div className="report-id print-only">
                <span className="report-id-name">{student.name}</span>
                <span className="report-id-meta">{student.grade} · {student.email}</span>
              </div>
              <div className="report-head">
                <h2 className="report-title">{current.title || "Update for my counselor"}</h2>
                <span className="muted report-period">{current.period_label || fmt(current.published_at)}</span>
              </div>

              {current.summary && <p className="report-body">{current.summary}</p>}

              {current.wins && (
                <div className="report-section">
                  <h3>Recent wins &amp; impact</h3>
                  <p className="report-body">{current.wins}</p>
                </div>
              )}

              {current.whats_next && (
                <div className="report-section">
                  <h3>What&apos;s next</h3>
                  <p className="report-body">{current.whats_next}</p>
                </div>
              )}

              {current.through_line && (
                <div className="callout">
                  <span className="callout-label">The through-line</span>
                  {current.through_line}
                </div>
              )}

              <div className="report-foot muted">Last updated {fmt(current.published_at)}</div>
            </div>
          </div>

          {/* Screen-only sidebar that fills the space beside the (print-width) report. */}
          {snap && (
            <aside className="counselor-aside no-print">
              <div className="card">
                <div className="card-h"><h3>At a glance</h3></div>
                <div className="card-b" style={{ paddingTop: 12 }}>
                  <div className="snap-grid">
                    <div className="snap-stat"><div className="v">{snap.gradYear ?? "—"}</div><div className="l">Class year</div></div>
                    <div className="snap-stat"><div className="v">{snap.sat ?? "—"}</div><div className="l">SAT superscore</div></div>
                    <div className="snap-stat"><div className="v">{snap.gpa || "—"}</div><div className="l">GPA</div></div>
                    <div className="snap-stat"><div className="v">{snap.colleges}</div><div className="l">Colleges</div></div>
                    <div className="snap-stat"><div className="v">{snap.activities}</div><div className="l">Activities</div></div>
                    <div className="snap-stat"><div className="v">{snap.competitions}</div><div className="l">Competitions</div></div>
                  </div>
                </div>
              </div>

              {snap.upcoming.length > 0 && (
                <div className="card" style={{ marginTop: 18 }}>
                  <div className="card-h"><h3>Next deadlines</h3></div>
                  <div className="card-b" style={{ paddingTop: 6, paddingBottom: 10 }}>
                    <div className="snap-up">
                      {snap.upcoming.map((u, i) => (
                        <div className="snap-up-row" key={i}>
                          <span className="t">{u.label}</span>
                          <span className="d">{u.when}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>
      )}

      {reports.length > 1 && (
        <div className="card no-print">
          <div className="card-h"><h3>Past updates</h3></div>
          <div className="card-b" style={{ paddingTop: 8 }}>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Date</th><th>Period</th><th /></tr></thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id} className={"clickable" + (r.id === (current?.id) ? " active-row" : "")} onClick={() => setSelectedId(r.id)}>
                      <td className="nowrap">{fmt(r.published_at)}</td>
                      <td>{r.period_label || "—"}</td>
                      <td className="t-actions">{r.id === current?.id ? <span className="chip ok">Viewing</span> : <button className="btn-sm" onClick={() => setSelectedId(r.id)}>View</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
