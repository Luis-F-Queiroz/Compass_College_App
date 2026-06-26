"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/lib/supabaseBrowser";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { rollbackRun, applyIncoming, markReviewed } from "@/lib/sync/operations.ts";
import type { SyncEntity, ConflictRecord } from "@/lib/sync/types.ts";

const ENTITIES: SyncEntity[] = ["colleges", "essays", "tasks", "activities", "ideas", "scholarship_deadlines", "profiles"];
const NAME_FIELD: Record<SyncEntity, string> = {
  colleges: "name", essays: "title", tasks: "title", activities: "name",
  ideas: "text", scholarship_deadlines: "label", profiles: "full_name",
};
type Run ={ id: string; mode: string; status: string; applied_at: string; summary: any };
type ReviewRow = { entity: SyncEntity; row: any; conflicts: ConflictRecord[] };

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function when(s: string) {
  const d = new Date(s);
  return `${M[d.getMonth()]} ${d.getDate()}, ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}
function statusChip(s: string) {
  if (s === "applied") return "ok";
  if (s === "rolled_back") return "dim";
  if (s === "partial" || s === "applying") return "warn";
  return "danger";
}
function fmtVal(v: unknown) {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s == null ? "—" : s.length > 60 ? s.slice(0, 57) + "…" : s;
}

export default function SyncDashboard() {
  const { session } = useAuth();
  const toast = useToast();
  const userId = session?.user.id ?? "";
  const [runs, setRuns] = useState<Run[]>([]);
  const [review, setReview] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const sb = supabase();
    const { data: runData } = await sb.from("sync_runs").select("id,mode,status,applied_at,summary").order("created_at", { ascending: false }).limit(20);
    const allRuns = (runData as Run[]) ?? [];

    // index conflicts (most-recent first) by entity::source_ref so each flagged row can show them
    const conflictIdx: Record<string, ConflictRecord[]> = {};
    for (const r of allRuns) {
      for (const c of (r.summary?.conflicts ?? []) as ConflictRecord[]) {
        const k = `${c.entity}::${c.source_ref}`;
        if (!conflictIdx[k]) conflictIdx[k] = [];
        conflictIdx[k].push(c);
      }
    }

    const reviewRows: ReviewRow[] = [];
    for (const entity of ENTITIES) {
      const { data } = await sb.from(entity).select("*").eq("sync_status", "needs_review").eq("archived", false);
      for (const row of (data as any[]) ?? []) {
        reviewRows.push({ entity, row, conflicts: conflictIdx[`${entity}::${row.source_ref}`] ?? [] });
      }
    }

    setRuns(allRuns);
    setReview(reviewRows);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const doRollback = async (runId: string) => {
    setBusy(runId);
    const res = await rollbackRun(supabase() as any, runId, userId);
    setBusy(null);
    if (res.error) toast("Rollback: " + res.error);
    else toast(`Rolled back — ${res.reverted} reverted`);
    await load();
  };
  const doApply = async (entity: SyncEntity, rowId: string, field: string, value: unknown) => {
    setBusy(rowId + field);
    await applyIncoming(supabase() as any, entity, rowId, userId, field, value);
    setBusy(null);
    toast(`Applied incoming ${field}`);
    await load();
  };
  const doReviewed = async (entity: SyncEntity, rowId: string) => {
    setBusy(rowId + "_ok");
    await markReviewed(supabase() as any, entity, rowId, userId);
    setBusy(null);
    toast("Marked reviewed");
    await load();
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Sync</h1>
          <p className="crumb">From CoWork → validated → this site. CoWork stays the source of truth.</p>
        </div>
      </div>

      {/* needs-review queue */}
      <div className="card">
        <div className="card-h"><h3>Needs review {review.length > 0 && <span className="chip warn" style={{ marginLeft: 8 }}>{review.length}</span>}</h3></div>
        <div className="card-b" style={{ paddingTop: 12 }}>
          {loading ? (
            <span className="skel skel-row" style={{ width: "60%" }} />
          ) : review.length === 0 ? (
            <div className="empty"><div className="big">Nothing to review</div>Synced records that conflict with your edits or are unverified will surface here.</div>
          ) : (
            <AnimatePresence initial={false}>
              {review.map((r) => {
                const id = (r.row.id ?? userId) as string;
                const label = r.row[NAME_FIELD[r.entity]] ?? r.row.source_ref ?? "(untitled)";
                return (
                  <motion.div key={`${r.entity}:${id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="review-item">
                    <div className="review-head">
                      <span className="strong">{String(label)}</span>
                      <span className="chip dim">{r.entity}</span>
                      {r.row.source && <span className="muted" style={{ fontSize: 12 }}>from {String(r.row.source)}</span>}
                    </div>
                    {r.conflicts.length > 0 ? (
                      r.conflicts.map((c, i) => (
                        <div key={i} className="conflict-row">
                          <span className="muted" style={{ fontSize: 13 }}>
                            <b>{c.field}</b>: keep “{fmtVal(c.existing_value)}” vs incoming “{fmtVal(c.incoming_value)}”
                          </span>
                          <span className="conflict-actions">
                            <button className="btn-sm" disabled={busy === id + c.field} onClick={() => doApply(r.entity, id, c.field, c.incoming_value)}>Apply incoming</button>
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="muted" style={{ fontSize: 13 }}>Unverified — confirm in the {r.entity} page, then mark reviewed.</div>
                    )}
                    <div style={{ marginTop: 8 }}>
                      <button className="btn-sm" disabled={busy === id + "_ok"} onClick={() => doReviewed(r.entity, id)}>Mark reviewed</button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* run history */}
      <div className="card">
        <div className="card-h"><h3>Sync runs</h3></div>
        <div className="card-b" style={{ paddingTop: 10 }}>
          {loading ? (
            <span className="skel skel-row" style={{ width: "70%" }} />
          ) : runs.length === 0 ? (
            <div className="empty"><div className="big">No syncs yet</div>Run a sync from CoWork to populate this site.</div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>When</th><th>Mode</th><th>Status</th><th>Changes</th><th /></tr></thead>
                <tbody>
                  {runs.map((r) => {
                    const s = r.summary ?? {};
                    const isRollback = s.rollback_of;
                    return (
                      <tr key={r.id}>
                        <td className="nowrap">{when(r.applied_at)}</td>
                        <td>{isRollback ? <span className="muted">rollback</span> : r.mode}</td>
                        <td><span className={"chip " + statusChip(r.status)}>{r.status}</span></td>
                        <td className="muted" style={{ fontSize: 13 }}>
                          {isRollback ? `${s.reverted ?? 0} reverted` : `+${s.inserted ?? 0} · ~${s.updated ?? 0} · ▢${s.archived ?? 0} · ?${s.needs_review ?? 0}`}
                        </td>
                        <td className="t-actions">
                          {(r.status === "applied" || r.status === "partial") && !isRollback && (
                            <button className="btn-sm" disabled={busy === r.id} onClick={() => doRollback(r.id)}>{busy === r.id ? "…" : "Roll back"}</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
