"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import Modal from "@/components/Modal";
import { SAT_LOGO, AP_LOGO, superscore, type Sitting } from "@/lib/collegeBoard";

type AP = { id: string; course: string | null; score: number | null; exam_year: number | null };

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(s: string | null) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  return `${M[+m[2] - 1]} ${m[1]}`;
}
const num = (v: string) => { const n = Number(v); return v.trim() === "" || !Number.isFinite(n) ? null : n; };

export default function CollegeBoard() {
  const { session } = useAuth();
  const toast = useToast();
  const uid = session?.user.id ?? "";
  const [sittings, setSittings] = useState<Sitting[]>([]);
  const [aps, setAps] = useState<AP[]>([]);
  const [loading, setLoading] = useState(true);
  const [editSit, setEditSit] = useState<Sitting | "new" | null>(null);
  const [editAp, setEditAp] = useState<AP | "new" | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const sb = supabase();
    const [s, a] = await Promise.all([
      sb.from("sat_sittings").select("*").order("test_date", { ascending: true, nullsFirst: true }),
      sb.from("ap_scores").select("*").order("exam_year", { ascending: true, nullsFirst: true }),
    ]);
    setSittings((s.data as Sitting[]) ?? []);
    setAps((a.data as AP[]) ?? []);
    setLoading(false);
  }, [session]);
  useEffect(() => { load(); }, [load]);

  const ss = superscore(sittings);
  const bestRWFrom = ss.bestRW != null ? sittings.find((x) => x.rw === ss.bestRW) : null;
  const bestMathFrom = ss.bestMath != null ? sittings.find((x) => x.math === ss.bestMath) : null;
  // single-test best total (the highest single sitting), to show the lift superscoring gives
  const singleBest = sittings
    .map((x) => (x.rw != null && x.math != null ? x.rw + x.math : null))
    .filter((n): n is number => n != null);
  const bestSingle = singleBest.length ? Math.max(...singleBest) : null;
  const lift = ss.total != null && bestSingle != null ? ss.total - bestSingle : null;

  const delSit = async (id: string) => { await supabase().from("sat_sittings").delete().eq("id", id); toast("Removed"); await load(); };
  const delAp = async (id: string) => { await supabase().from("ap_scores").delete().eq("id", id); toast("Removed"); await load(); };

  const ap45 = aps.filter((a) => (a.score ?? 0) >= 4).length;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>College Board</h1>
          <p className="crumb">Your SAT sittings (auto-superscored) and AP scores.</p>
        </div>
        <div className="toolbar">
          <a className="btn" href="https://account.collegeboard.org/login/" target="_blank" rel="noopener noreferrer">Open College Board ↗</a>
        </div>
      </div>

      {/* SAT */}
      <div className="card">
        <div className="card-h cb-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="cb-logo" src={SAT_LOGO} alt="SAT" height={26} />
          <button className="btn-sm primary" onClick={() => setEditSit("new")}>+ Add sitting</button>
        </div>
        <div className="card-b" style={{ paddingTop: 6 }}>
          <div className="cb-super">
            <div className="cb-super-main">
              <div className="cb-super-n">{ss.total ?? "—"}</div>
              <div className="cb-super-l">SAT superscore</div>
            </div>
            <div className="cb-super-break">
              <div><span className="cb-seg">{ss.bestRW ?? "—"}</span> R&amp;W{bestRWFrom?.label ? <span className="muted"> · {bestRWFrom.label}</span> : null}</div>
              <div className="cb-plus">+</div>
              <div><span className="cb-seg">{ss.bestMath ?? "—"}</span> Math{bestMathFrom?.label ? <span className="muted"> · {bestMathFrom.label}</span> : null}</div>
              {lift != null && lift > 0 && <div className="chip ok" style={{ alignSelf: "center" }}>+{lift} from superscoring</div>}
            </div>
          </div>

          {loading ? (
            <span className="skel skel-row" style={{ width: "60%" }} />
          ) : sittings.length === 0 ? (
            <div className="empty">No SAT sittings yet — add one to start your superscore.</div>
          ) : (
            <div className="cb-rows">
              {sittings.map((s) => {
                const total = s.rw != null && s.math != null ? s.rw + s.math : null;
                return (
                  <div className="cb-row" key={s.id}>
                    <div className="cb-row-main">
                      <span className="strong">{s.label || "Sitting"}</span>
                      {fmtDate(s.test_date) && <span className="muted" style={{ fontSize: 13 }}> · {fmtDate(s.test_date)}</span>}
                    </div>
                    <span className={"cb-score" + (ss.bestRW != null && s.rw === ss.bestRW ? " best" : "")}>{s.rw ?? "—"}<small>R&amp;W</small></span>
                    <span className={"cb-score" + (ss.bestMath != null && s.math === ss.bestMath ? " best" : "")}>{s.math ?? "—"}<small>Math</small></span>
                    <span className="cb-score total">{total ?? "—"}<small>total</small></span>
                    <span className="cb-row-act">
                      <button className="btn-sm" onClick={() => setEditSit(s)}>Edit</button>
                      <button className="btn-sm danger" onClick={() => delSit(s.id)}>Delete</button>
                    </span>
                  </div>
                );
              })}
              <div className="muted cb-note">Superscore = your best R&amp;W and best Math across all sittings (the score most colleges use).</div>
            </div>
          )}
        </div>
      </div>

      {/* AP */}
      <div className="card">
        <div className="card-h cb-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="cb-logo" src={AP_LOGO} alt="Advanced Placement" height={28} />
          <span style={{ flex: 1 }} />
          {aps.length > 0 && <span className="chip dim">{aps.length} exam{aps.length > 1 ? "s" : ""} · {ap45} scored 4+</span>}
          <button className="btn-sm primary" onClick={() => setEditAp("new")}>+ Add AP</button>
        </div>
        <div className="card-b" style={{ paddingTop: 8 }}>
          {loading ? (
            <span className="skel skel-row" style={{ width: "50%" }} />
          ) : aps.length === 0 ? (
            <div className="empty">No AP scores yet.</div>
          ) : (
            <div className="cb-rows">
              {aps.map((a) => (
                <div className="cb-row" key={a.id}>
                  <div className="cb-row-main">
                    <span className="strong">{a.course || "AP exam"}</span>
                    {a.exam_year ? <span className="muted" style={{ fontSize: 13 }}> · {a.exam_year}</span> : null}
                  </div>
                  <span className={"chip " + ((a.score ?? 0) >= 4 ? "ok" : (a.score ?? 0) === 3 ? "blue" : "dim")}>{a.score ?? "—"}/5</span>
                  <span className="cb-row-act">
                    <button className="btn-sm" onClick={() => setEditAp(a)}>Edit</button>
                    <button className="btn-sm danger" onClick={() => delAp(a.id)}>Delete</button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editSit !== null && (
        <SittingForm record={editSit === "new" ? null : editSit} uid={uid} onClose={() => setEditSit(null)} onSaved={async () => { setEditSit(null); await load(); }} />
      )}
      {editAp !== null && (
        <ApForm record={editAp === "new" ? null : editAp} uid={uid} onClose={() => setEditAp(null)} onSaved={async () => { setEditAp(null); await load(); }} />
      )}
    </>
  );
}

function SittingForm({ record, uid, onClose, onSaved }: { record: Sitting | null; uid: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    label: record?.label ?? "",
    test_date: record?.test_date ?? "",
    rw: record?.rw != null ? String(record.rw) : "",
    math: record?.math != null ? String(record.math) : "",
  });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    const rw = num(f.rw), math = num(f.math);
    if (rw != null && (rw < 200 || rw > 800)) { setErr("R&W must be 200–800."); return; }
    if (math != null && (math < 200 || math > 800)) { setErr("Math must be 200–800."); return; }
    const payload = { label: f.label.trim() || null, test_date: f.test_date || null, rw, math };
    try {
      if (record) await supabase().from("sat_sittings").update(payload).eq("id", record.id);
      else await supabase().from("sat_sittings").insert({ ...payload, user_id: uid });
      toast(record ? "Saved" : "Sitting added");
      onSaved();
    } catch (e) { setErr("Could not save — " + (e as Error).message); }
  };
  const footer = (<><button className="btn" onClick={onClose}>Cancel</button><span style={{ flex: 1 }} /><button className="btn primary" onClick={save}>{record ? "Save" : "Add sitting"}</button></>);
  return (
    <Modal open onClose={onClose} title={record ? "Edit SAT sitting" : "New SAT sitting"} footer={footer}>
      <div className="form">
        <div className="field full"><label>Label (e.g. &quot;March 2026&quot;)</label><input value={f.label} onChange={(e) => set("label", e.target.value)} /></div>
        <div className="field"><label>Test date</label><input type="date" value={f.test_date} onChange={(e) => set("test_date", e.target.value)} /></div>
        <div className="field" />
        <div className="field"><label>Reading &amp; Writing (200–800)</label><input type="number" value={f.rw} onChange={(e) => set("rw", e.target.value)} /></div>
        <div className="field"><label>Math (200–800)</label><input type="number" value={f.math} onChange={(e) => set("math", e.target.value)} /></div>
      </div>
      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{err}</div>}
    </Modal>
  );
}

function ApForm({ record, uid, onClose, onSaved }: { record: AP | null; uid: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    course: record?.course ?? "",
    score: record?.score != null ? String(record.score) : "",
    exam_year: record?.exam_year != null ? String(record.exam_year) : "",
  });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.course.trim()) { setErr("Course is required."); return; }
    const score = num(f.score);
    if (score != null && (score < 1 || score > 5)) { setErr("AP score is 1–5."); return; }
    const payload = { course: f.course.trim(), score, exam_year: num(f.exam_year) };
    try {
      if (record) await supabase().from("ap_scores").update(payload).eq("id", record.id);
      else await supabase().from("ap_scores").insert({ ...payload, user_id: uid });
      toast(record ? "Saved" : "AP score added");
      onSaved();
    } catch (e) { setErr("Could not save — " + (e as Error).message); }
  };
  const footer = (<><button className="btn" onClick={onClose}>Cancel</button><span style={{ flex: 1 }} /><button className="btn primary" onClick={save}>{record ? "Save" : "Add AP"}</button></>);
  return (
    <Modal open onClose={onClose} title={record ? "Edit AP score" : "New AP score"} footer={footer}>
      <div className="form">
        <div className="field full"><label>Course (e.g. &quot;AP Calculus BC&quot;)</label><input value={f.course} onChange={(e) => set("course", e.target.value)} /></div>
        <div className="field"><label>Score (1–5)</label><input type="number" value={f.score} onChange={(e) => set("score", e.target.value)} /></div>
        <div className="field"><label>Year</label><input type="number" value={f.exam_year} onChange={(e) => set("exam_year", e.target.value)} /></div>
      </div>
      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{err}</div>}
    </Modal>
  );
}
