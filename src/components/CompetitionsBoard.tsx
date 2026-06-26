"use client";
/* Bespoke Competitions page: a status-pipeline board (not the generic table).
   Columns follow the COMP_STATUS lifecycle; each card surfaces prestige, the next
   date, the result/medal, and phases. Same data + CRUD as the generic screen. */
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Modal from "@/components/Modal";
import { useCollection, type Row } from "@/hooks/useCollection";
import { useToast } from "@/components/Toast";
import { COMP_STATUS, DIFFICULTY, PRESTIGE } from "@/lib/specs";

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(s: unknown): string | null {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(s);
  return `${M[+m[2] - 1]} ${+m[3]}, ${m[1]}`;
}
const str = (v: unknown) => (v == null ? "" : String(v));

// Column accent + the chip tone used for the status pill.
const STATUS_META: Record<string, { accent: string }> = {
  Researching: { accent: "var(--ink-48)" },
  Registered: { accent: "var(--blue)" },
  "In progress": { accent: "var(--warn)" },
  Completed: { accent: "var(--ok)" },
  "Not pursuing": { accent: "var(--ink-48)" },
};
function prestigeChip(p: string): string | null {
  if (!p) return null;
  if (p === "Super High") return "ok";
  if (p === "High") return "blue";
  return "dim"; // Mid / Low
}

export default function CompetitionsBoard() {
  const { rows, loading, create, update, remove, fetchArchived } = useCollection("competitions");
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [archivedRows, setArchivedRows] = useState<Row[] | null>(null);
  const toast = useToast();

  const grouped = useMemo(() => {
    const g: Record<string, Row[]> = {};
    for (const st of COMP_STATUS) g[st] = [];
    const extra: Row[] = [];
    for (const r of rows) {
      const st = str(r.status);
      if (g[st]) g[st].push(r);
      else extra.push(r);
    }
    return { g, extra };
  }, [rows]);

  const done = rows.filter((r) => str(r.status) === "Completed").length;
  const active = rows.filter((r) => ["Registered", "In progress"].includes(str(r.status))).length;
  const medals = rows.filter((r) => str(r.result).trim() !== "").length;
  const summary = `${rows.length} tracked · ${active} active · ${done} completed${medals ? ` · ${medals} with results` : ""}`;

  const toggleArchived = async () => {
    if (archivedRows !== null) { setArchivedRows(null); return; }
    setArchivedRows(await fetchArchived());
  };
  const doArchive = async (id: string) => {
    await update(id, { archived: true });
    toast("Archived");
    if (archivedRows !== null) setArchivedRows(await fetchArchived());
  };
  const doUnarchive = async (id: string) => {
    await update(id, { archived: false });
    toast("Unarchived");
    setArchivedRows(await fetchArchived());
  };

  const cols = [...COMP_STATUS, ...(grouped.extra.length ? ["Unsorted"] : [])];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Competitions</h1>
          <p className="crumb">{loading ? "Loading…" : summary}</p>
        </div>
        <div className="toolbar">
          <button className="btn" onClick={toggleArchived}>{archivedRows !== null ? "Hide archived" : "Show archived"}</button>
          <button className="btn primary" onClick={() => setEditing("new")}>+ Add competition</button>
        </div>
      </div>

      {loading ? (
        <div className="cboard">
          {COMP_STATUS.map((st) => (
            <div className="ccol" key={st}>
              <div className="ccol-head"><span className="ccol-dot" style={{ background: STATUS_META[st].accent }} /><span className="ccol-title">{st}</span></div>
              <div className="ccol-body">
                {[0, 1].map((i) => <span key={i} className="skel" style={{ height: 78, borderRadius: 12 }} />)}
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="card"><div className="empty"><div className="big">No competitions yet</div>Add your first, or they’ll arrive from CoWork.</div></div>
      ) : (
        <div className="cboard">
          {cols.map((st) => {
            const items = st === "Unsorted" ? grouped.extra : grouped.g[st];
            return (
              <div className="ccol" key={st}>
                <div className="ccol-head">
                  <span className="ccol-dot" style={{ background: (STATUS_META[st]?.accent) || "var(--ink-48)" }} />
                  <span className="ccol-title">{st}</span>
                  <span className="ccol-count">{items.length}</span>
                </div>
                <div className="ccol-body">
                  {st === "Unsorted" && (
                    <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                      Unrecognized status — edit each to a valid status to sort it into the board.
                    </div>
                  )}
                  <AnimatePresence initial={false}>
                    {items.map((c) => (
                      <CompCard key={c.id} c={c} onEdit={() => setEditing(c)} onArchive={() => doArchive(c.id)} />
                    ))}
                  </AnimatePresence>
                  {items.length === 0 && <div className="ccol-empty">—</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {archivedRows !== null && (
        <div className="card">
          <div className="card-h"><h3>Archived{archivedRows.length > 0 && <span className="chip dim" style={{ marginLeft: 8 }}>{archivedRows.length}</span>}</h3></div>
          <div className="card-b" style={{ paddingTop: 10 }}>
            {archivedRows.length === 0 ? (
              <div className="muted" style={{ fontSize: 14 }}>No archived competitions.</div>
            ) : (
              <div className="supp-list">
                {archivedRows.map((r) => (
                  <div key={r.id} className="supp-item" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="strong" style={{ flex: 1 }}>{str(r.name) || "—"}</span>
                    {r.status ? <span className="chip dim">{str(r.status)}</span> : null}
                    <button className="btn-sm" onClick={() => doUnarchive(r.id)}>Unarchive</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {editing && (
        <CompetitionForm
          record={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
          create={create}
          update={update}
          remove={remove}
        />
      )}
    </>
  );
}

function CompCard({ c, onEdit, onArchive }: { c: Row; onEdit: () => void; onArchive: () => void }) {
  const prestige = str(c.prestige);
  const pc = prestigeChip(prestige);
  const meta = [str(c.topic), str(c.difficulty)].filter(Boolean).join(" · ");
  const reg = fmtDate(c.registration_deadline);
  const start = fmtDate(c.start_date);
  const dates = [reg && `Reg ${reg}`, start && `Event ${start}`].filter(Boolean).join(" · ");
  const result = str(c.result).trim();
  const phases = str(c.phases).trim();
  const url = str(c.website_url).trim();
  return (
    <motion.div layout className="ccard" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.16 }}>
      <div className="ccard-top">
        <span className="ccard-name">{str(c.name) || "Untitled"}</span>
        {pc && <span className={"chip " + pc} title="Prestige">{prestige}</span>}
      </div>
      {meta && <div className="ccard-meta">{meta}</div>}
      {dates && <div className="ccard-dates">{dates}</div>}
      {result && <div className="ccard-result">{result}</div>}
      {phases && <div className="ccard-phases">{phases}</div>}
      <div className="ccard-foot">
        {url && <a className="btn-sm" href={url} target="_blank" rel="noopener noreferrer">Site ↗</a>}
        <button className="btn-sm" onClick={onEdit}>Edit</button>
        <button className="btn-sm" onClick={onArchive}>Archive</button>
      </div>
    </motion.div>
  );
}

const FORM_FIELDS: { k: string; label: string; full?: boolean; sel?: string[]; type?: "url" | "date" | "textarea" }[] = [
  { k: "name", label: "Name", full: true },
  { k: "topic", label: "Topic (Essay, Case, Investments…)" },
  { k: "status", label: "Status", sel: COMP_STATUS },
  { k: "prestige", label: "Prestige", sel: PRESTIGE },
  { k: "difficulty", label: "Difficulty", sel: DIFFICULTY },
  { k: "website_url", label: "Website URL", type: "url" },
  { k: "registration_deadline", label: "Registration deadline", type: "date" },
  { k: "start_date", label: "Start date", type: "date" },
  { k: "result", label: "Result / outcome", full: true, type: "textarea" },
  { k: "phases", label: "Phases / schedule", full: true, type: "textarea" },
];

function CompetitionForm({
  record, onClose, onSaved, create, update, remove,
}: {
  record: Row | null;
  onClose: () => void;
  onSaved: () => void;
  create: (v: Record<string, unknown>) => Promise<Row | null>;
  update: (id: string, v: Record<string, unknown>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}) {
  const toast = useToast();
  const isEdit = !!record;
  const [f, setF] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const fl of FORM_FIELDS) o[fl.k] = str(record?.[fl.k]);
    return o;
  });
  const [err, setErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.name.trim()) { setErr("Name is required."); return; }
    const payload: Record<string, unknown> = {};
    for (const fl of FORM_FIELDS) payload[fl.k] = f[fl.k].trim() === "" ? null : f[fl.k].trim();
    try {
      if (record) await update(record.id, payload);
      else await create(payload);
      toast(record ? "Saved" : "Added competition");
      onSaved();
    } catch (e) {
      setErr("Could not save — " + (e as Error).message);
    }
  };
  const doArchive = async () => {
    if (!record) return;
    try { await update(record.id, { archived: true }); toast("Archived"); onSaved(); }
    catch (e) { setErr("Archive failed — " + (e as Error).message); }
  };
  const doDelete = async () => {
    if (!record) return;
    try { await remove(record.id); toast("Removed"); onSaved(); }
    catch (e) { setConfirming(false); setErr("Delete failed — " + (e as Error).message); }
  };

  const footer = isEdit ? (
    <>
      {confirming ? (
        <span className="inline-confirm" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="muted" style={{ fontSize: 13 }}>Delete “{str(record?.name) || "this competition"}”?</span>
          <button className="btn-sm" onClick={() => setConfirming(false)}>Cancel</button>
          <button className="btn-sm danger" onClick={doDelete}>Delete</button>
        </span>
      ) : (
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="btn danger" onClick={() => setConfirming(true)}>Delete</button>
          <button className="btn" onClick={doArchive}>Archive</button>
        </span>
      )}
      <span style={{ flex: 1 }} />
      <button className="btn primary" onClick={save}>Save</button>
    </>
  ) : (
    <>
      <button className="btn" onClick={onClose}>Cancel</button>
      <span style={{ flex: 1 }} />
      <button className="btn primary" onClick={save}>Add competition</button>
    </>
  );

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit competition" : "New competition"} footer={footer} wide>
      <div className="form">
        {FORM_FIELDS.map((fl) => (
          <div className={"field" + (fl.full ? " full" : "")} key={fl.k}>
            <label htmlFor={"c-" + fl.k}>{fl.label}{fl.k === "name" && <span style={{ color: "var(--danger)" }}> *</span>}</label>
            {fl.sel ? (
              <select id={"c-" + fl.k} value={f[fl.k]} onChange={(e) => set(fl.k, e.target.value)}>
                <option value="" />
                {fl.sel.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : fl.type === "textarea" ? (
              <textarea id={"c-" + fl.k} value={f[fl.k]} onChange={(e) => set(fl.k, e.target.value)} />
            ) : (
              <input id={"c-" + fl.k} type={fl.type === "date" ? "date" : fl.type === "url" ? "url" : "text"} value={f[fl.k]} onChange={(e) => set(fl.k, e.target.value)} />
            )}
          </div>
        ))}
      </div>
      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{err}</div>}
    </Modal>
  );
}
