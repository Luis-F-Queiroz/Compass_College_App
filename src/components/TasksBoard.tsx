"use client";
/* Bespoke Tasks page — a real task tracker (Todoist / Apple Reminders / Things-style):
   quick-add, click-to-complete (done tasks animate out and disappear), grouping by due date
   (Overdue / Today / Upcoming / No date), priority flags, and a collapsible Completed section. */
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Modal from "@/components/Modal";
import { useCollection, type Row } from "@/hooks/useCollection";
import { useToast } from "@/components/Toast";
import { PRIORITY, TASK_STATUS } from "@/lib/specs";

const str = (v: unknown) => (v == null ? "" : String(v));
const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function daysUntil(s: unknown): number | null {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  const t = new Date();
  const t0 = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((d.getTime() - t0.getTime()) / 86400000);
}
function relDue(s: unknown): { label: string; tone: "danger" | "warn" | "muted" } | null {
  const n = daysUntil(s);
  if (n == null) return null;
  if (n < 0) return { label: `${Math.abs(n)}d overdue`, tone: "danger" };
  if (n === 0) return { label: "Today", tone: "warn" };
  if (n === 1) return { label: "Tomorrow", tone: "muted" };
  const m = (s as string).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (n < 7) return { label: WD[d.getDay()], tone: "muted" };
    return { label: `${M[+m[2] - 1]} ${+m[3]}`, tone: "muted" };
  }
  return { label: `in ${n} days`, tone: "muted" };
}
const PRANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
const PCOLOR: Record<string, string> = { High: "var(--danger)", Medium: "var(--warn)", Low: "var(--ink-48)" };

function sortTasks(a: Row, b: Row): number {
  const pa = PRANK[str(a.priority)] ?? 1.5;
  const pb = PRANK[str(b.priority)] ?? 1.5;
  if (pa !== pb) return pa - pb;
  const da = daysUntil(a.due_date);
  const db = daysUntil(b.due_date);
  if (da == null && db == null) return 0;
  if (da == null) return 1;
  if (db == null) return -1;
  return da - db;
}

export default function TasksBoard() {
  const { rows, loading, create, update, remove } = useCollection("tasks");
  const toast = useToast();
  const [editing, setEditing] = useState<Row | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [qTitle, setQTitle] = useState("");
  const [qDue, setQDue] = useState("");
  const [qPriority, setQPriority] = useState("");
  const [adding, setAdding] = useState(false);

  const active = useMemo(() => rows.filter((r) => str(r.status) !== "Done"), [rows]);
  const done = useMemo(() => rows.filter((r) => str(r.status) === "Done"), [rows]);

  const groups = useMemo(() => {
    const g: { key: string; label: string; danger?: boolean; items: Row[] }[] = [
      { key: "overdue", label: "Overdue", danger: true, items: [] },
      { key: "today", label: "Today", items: [] },
      { key: "upcoming", label: "Upcoming", items: [] },
      { key: "someday", label: "No date", items: [] },
    ];
    for (const r of active) {
      const n = daysUntil(r.due_date);
      if (n == null) g[3].items.push(r);
      else if (n < 0) g[0].items.push(r);
      else if (n === 0) g[1].items.push(r);
      else g[2].items.push(r);
    }
    for (const grp of g) grp.items.sort(sortTasks);
    return g.filter((grp) => grp.items.length > 0);
  }, [active]);

  const overdueCount = active.filter((r) => { const n = daysUntil(r.due_date); return n != null && n < 0; }).length;

  const quickAdd = async () => {
    const title = qTitle.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      await create({ title, due_date: qDue || null, priority: qPriority || null, status: "Open" });
      setQTitle("");
      setQDue("");
      setQPriority("");
    } catch (e) {
      toast("Couldn't add — " + (e as Error).message);
    } finally {
      setAdding(false);
    }
  };
  const complete = async (r: Row) => {
    try { await update(r.id, { status: "Done" }); } catch (e) { toast("Couldn't update — " + (e as Error).message); }
  };
  const reopen = async (r: Row) => {
    try { await update(r.id, { status: "Open" }); } catch (e) { toast("Couldn't update — " + (e as Error).message); }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Tasks</h1>
          <p className="crumb">
            {loading ? "Loading…" : `${active.length} open${overdueCount ? ` · ${overdueCount} overdue` : ""}${done.length ? ` · ${done.length} done` : ""}`}
          </p>
        </div>
      </div>

      <div className="card task-add">
        <input
          className="task-add-title"
          placeholder="Add a task…"
          value={qTitle}
          onChange={(e) => setQTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); quickAdd(); } }}
          aria-label="Task title"
        />
        <input className="task-add-date" type="date" value={qDue} onChange={(e) => setQDue(e.target.value)} aria-label="Due date" />
        <select className="task-add-prio" value={qPriority} onChange={(e) => setQPriority(e.target.value)} aria-label="Priority">
          <option value="">Priority</option>
          {PRIORITY.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button className="btn primary" onClick={quickAdd} disabled={!qTitle.trim() || adding}>Add</button>
      </div>

      {loading ? (
        <div className="card"><div className="card-b">{[0, 1, 2].map((i) => <span key={i} className="skel skel-row" style={{ width: i % 2 ? "55%" : "75%" }} />)}</div></div>
      ) : active.length === 0 ? (
        <div className="card"><div className="empty"><div className="big">No open tasks</div>{done.length ? "All caught up — nice." : "Add your first task above."}</div></div>
      ) : (
        groups.map((grp) => (
          <div className="task-group" key={grp.key}>
            <div className="task-group-h">
              <span className={"task-group-title" + (grp.danger ? " danger" : "")}>{grp.label}</span>
              <span className="task-group-count">{grp.items.length}</span>
            </div>
            <div className="card"><div className="card-b" style={{ paddingTop: 6, paddingBottom: 6 }}>
              <AnimatePresence initial={false}>
                {grp.items.map((r) => (
                  <TaskRow key={r.id} r={r} onComplete={() => complete(r)} onEdit={() => setEditing(r)} />
                ))}
              </AnimatePresence>
            </div></div>
          </div>
        ))
      )}

      {done.length > 0 && (
        <div className="task-group">
          <button className="task-done-toggle" onClick={() => setShowDone((s) => !s)} aria-expanded={showDone}>
            {showDone ? "▾" : "▸"} Completed <span className="task-group-count">{done.length}</span>
          </button>
          {showDone && (
            <div className="card"><div className="card-b" style={{ paddingTop: 6, paddingBottom: 6 }}>
              {done.slice().sort((a, b) => str(b.updated_at).localeCompare(str(a.updated_at))).map((r) => (
                <div key={r.id} className="taskrow done">
                  <button className="task-check checked" aria-label="Mark not done" onClick={() => reopen(r)}>✓</button>
                  <div className="taskrow-main"><span className="taskrow-title">{str(r.title) || "Untitled"}</span></div>
                  <button className="btn-sm" onClick={() => setEditing(r)}>Edit</button>
                </div>
              ))}
            </div></div>
          )}
        </div>
      )}

      {editing && (
        <TaskForm
          record={editing}
          onClose={() => setEditing(null)}
          onSave={async (v) => { await update(editing.id, v); setEditing(null); toast("Saved"); }}
          onDelete={async () => { await remove(editing.id); setEditing(null); toast("Deleted"); }}
        />
      )}
    </>
  );
}

function TaskRow({ r, onComplete, onEdit }: { r: Row; onComplete: () => void; onEdit: () => void }) {
  const rel = relDue(r.due_date);
  const prio = str(r.priority);
  return (
    <motion.div
      layout
      className="taskrow clickable"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.18 }}
      onClick={onEdit}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onEdit(); }}
    >
      <button className="task-check" aria-label="Mark done" onClick={(e) => { e.stopPropagation(); onComplete(); }} />
      <div className="taskrow-main">
        <span className="taskrow-title">{str(r.title) || "Untitled"}</span>
        {(rel || prio) && (
          <span className="taskrow-meta">
            {prio && <span className="task-flag" style={{ color: PCOLOR[prio] || "var(--ink-48)" }}>⚑ {prio}</span>}
            {rel && <span className={"task-due " + rel.tone}>{rel.label}</span>}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function TaskForm({
  record, onClose, onSave, onDelete,
}: {
  record: Row;
  onClose: () => void;
  onSave: (v: Record<string, unknown>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [f, setF] = useState({
    title: str(record.title),
    due_date: str(record.due_date),
    priority: str(record.priority),
    status: str(record.status) || "Open",
    notes: str(record.notes),
  });
  const [err, setErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.title.trim()) { setErr("Task title is required."); return; }
    try {
      await onSave({
        title: f.title.trim(),
        due_date: f.due_date || null,
        priority: f.priority || null,
        status: f.status || "Open",
        notes: f.notes.trim() || null,
      });
    } catch (e) {
      setErr("Couldn't save — " + (e as Error).message);
    }
  };

  const footer = (
    <>
      {confirming ? (
        <span className="inline-confirm" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="muted" style={{ fontSize: 13 }}>Delete “{str(record.title) || "this task"}”?</span>
          <button className="btn-sm" onClick={() => setConfirming(false)}>Cancel</button>
          <button className="btn-sm danger" onClick={onDelete}>Delete</button>
        </span>
      ) : (
        <button className="btn danger" onClick={() => setConfirming(true)}>Delete</button>
      )}
      <span style={{ flex: 1 }} />
      <button className="btn primary" onClick={save}>Save</button>
    </>
  );

  return (
    <Modal open onClose={onClose} title="Edit task" footer={footer} wide>
      <div className="form">
        <div className="field full">
          <label htmlFor="t-title">Task<span style={{ color: "var(--danger)" }}> *</span></label>
          <input id="t-title" value={f.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="t-due">Due date</label>
          <input id="t-due" type="date" value={f.due_date} onChange={(e) => set("due_date", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="t-prio">Priority</label>
          <select id="t-prio" value={f.priority} onChange={(e) => set("priority", e.target.value)}>
            <option value="" />
            {PRIORITY.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="t-status">Status</label>
          <select id="t-status" value={f.status} onChange={(e) => set("status", e.target.value)}>
            {TASK_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field full">
          <label htmlFor="t-notes">Notes</label>
          <textarea id="t-notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </div>
      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{err}</div>}
    </Modal>
  );
}
