"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";
import { useAuth } from "@/components/AuthProvider";

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

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmt(s: string | null) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return `${M[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function CounselorReports() {
  const { session } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase()
      .from("counselor_reports")
      .select("*")
      .order("published_at", { ascending: false });
    setReports((data as Report[]) ?? []);
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
        <div className="card printable report-doc">
          <div className="card-b" style={{ padding: "30px 34px" }}>
            {/* shown only in the printed / saved-PDF report, never on screen */}
            <div className="report-id print-only">
              <span className="report-id-name">Luis Queiroz</span>
              <span className="report-id-meta">Class of 2028 · luisqueiroz236@gmail.com</span>
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
