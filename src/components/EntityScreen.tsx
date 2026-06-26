"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import CollegeLogo from "@/components/CollegeLogo";
import { useToast } from "@/components/Toast";
import { useCollection, type Row } from "@/hooks/useCollection";
import { SPECS, type Spec } from "@/lib/specs";
import SupplementPanel from "@/components/SupplementPanel";

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(s: unknown) {
  if (!s || typeof s !== "string") return "—";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(s);
  return `${M[+m[2] - 1]} ${+m[3]}, ${m[1]}`;
}
function toForm(spec: Spec, row: Partial<Row>): Record<string, string> {
  const f: Record<string, string> = {};
  for (const fl of spec.fields) {
    const v = row[fl.k];
    if (fl.type === "tags") f[fl.k] = Array.isArray(v) ? (v as unknown[]).join(", ") : v ? String(v) : "";
    else f[fl.k] = v === undefined || v === null ? "" : String(v);
  }
  return f;
}
function fromForm(spec: Spec, form: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const fl of spec.fields) {
    const raw = (form[fl.k] ?? "").trim();
    if (fl.type === "number") {
      const n = Number(raw);
      out[fl.k] = raw === "" || !Number.isFinite(n) ? null : n;
    } else if (fl.type === "tags") {
      out[fl.k] = raw === "" ? [] : raw.split(",").map((s) => s.trim()).filter(Boolean);
    } else out[fl.k] = raw === "" ? null : raw;
  }
  return out;
}

export default function EntityScreen({ entity, toolbarExtra }: { entity: string; toolbarExtra?: ReactNode }) {
  const spec = SPECS[entity];
  const { rows, loading, create, update, remove, refresh, fetchArchived } = useCollection(spec.table);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [archivedRows, setArchivedRows] = useState<Row[] | null>(null); // null = panel hidden
  const [essaysFor, setEssaysFor] = useState<Row | null>(null); // institution whose supplements panel is open
  const toast = useToast();
  const router = useRouter();

  const toggleArchived = async () => {
    if (archivedRows !== null) { setArchivedRows(null); return; }
    setArchivedRows(await fetchArchived());
  };
  const doUnarchive = async (id: string) => {
    await update(id, { archived: false });
    toast("Unarchived");
    await refresh();
    setArchivedRows(await fetchArchived());
  };
  // archive a row directly (read-only entities have no edit modal to archive from)
  const doArchiveRow = async (id: string) => {
    await update(id, { archived: true });
    toast("Archived");
    if (archivedRows !== null) setArchivedRows(await fetchArchived());
  };

  return (
    <>
      <div className="topbar">
        <div><h1>{spec.title}</h1></div>
        <div className="toolbar">
          {toolbarExtra}
          {spec.readonly ? (
            <>
              {spec.archivable && <button className="btn" onClick={toggleArchived}>{archivedRows !== null ? "Hide archived" : "Show archived"}</button>}
              <span className="muted" style={{ fontSize: 13 }}>Read-only · maintained in CoWork</span>
            </>
          ) : (
            <>
              <button className="btn" onClick={toggleArchived}>{archivedRows !== null ? "Hide archived" : "Show archived"}</button>
              <button className="btn primary" onClick={() => setEditing("new")}>+ Add {spec.singular}</button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-b" style={{ paddingTop: 10 }}>
          {loading ? (
            <div aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="skel skel-row" style={{ width: i % 2 ? "62%" : "82%" }} />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="empty">
              <div className="big">No {spec.title.toLowerCase()} yet</div>
              {spec.readonly ? "Added via CoWork." : `Add your first ${spec.singular}.`}
            </div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>{spec.columns.map((c) => <th key={c.k}>{c.label}</th>)}<th /></tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {rows.map((r) => (
                      <motion.tr key={r.id} className={spec.detail || !spec.readonly ? "clickable" : ""}
                        tabIndex={spec.detail || !spec.readonly ? 0 : undefined}
                        onClick={() => { if (spec.detail) router.push(`/${spec.table}/${r.id}`); else if (!spec.readonly) setEditing(r); }}
                        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && (spec.detail || !spec.readonly)) { e.preventDefault(); if (spec.detail) router.push(`/${spec.table}/${r.id}`); else setEditing(r); } }}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
                        {spec.columns.map((c, i) => (
                          <td key={c.k}>
                            {i === 0 && spec.logo ? (
                              <span style={{ display: "flex", alignItems: "center", gap: 11 }}>
                                <CollegeLogo name={String(r.name || "")} websiteUrl={r.website_url as string} logoUrl={r.logo_url as string} size={30} />
                                <span className="strong">{String(r[c.k] ?? "—")}</span>
                              </span>
                            ) : c.type === "date" ? (
                              <span className="nowrap">{fmtDate(r[c.k])}</span>
                            ) : c.type === "chip" ? (
                              r[c.k] ? <span className="chip">{String(r[c.k])}</span> : <span className="muted">—</span>
                            ) : i === 0 ? (
                              <span className="strong">{String(r[c.k] ?? "—")}</span>
                            ) : (
                              <span>{r[c.k] == null || r[c.k] === "" ? <span className="muted">—</span> : String(r[c.k])}</span>
                            )}
                          </td>
                        ))}
                        <td className="t-actions" onClick={(e) => e.stopPropagation()}>
                          {spec.essays && <button className="btn-sm" onClick={() => setEssaysFor(r)} style={{ marginRight: 6 }}>Essays</button>}
                          {spec.linkField && r[spec.linkField.key] ? (
                            <a className="btn-sm" href={String(r[spec.linkField.key])} target="_blank" rel="noopener noreferrer" style={{ marginRight: 6 }}>{spec.linkField.label}</a>
                          ) : null}
                          {!spec.readonly && <button className="btn-sm" onClick={() => setEditing(r)}>Edit</button>}
                          {spec.archivable && <button className="btn-sm" onClick={() => doArchiveRow(r.id)}>Archive</button>}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {archivedRows !== null && (
        <div className="card">
          <div className="card-h"><h3>Archived{archivedRows.length > 0 && <span className="chip dim" style={{ marginLeft: 8 }}>{archivedRows.length}</span>}</h3></div>
          <div className="card-b" style={{ paddingTop: 10 }}>
            {archivedRows.length === 0 ? (
              <div className="muted" style={{ fontSize: 14 }}>No archived {spec.title.toLowerCase()}.</div>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <tbody>
                    {archivedRows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          {spec.logo ? (
                            <span style={{ display: "flex", alignItems: "center", gap: 11 }}>
                              <CollegeLogo name={String(r.name || "")} websiteUrl={r.website_url as string} logoUrl={r.logo_url as string} size={26} />
                              <span className="strong">{String(r[spec.columns[0].k] ?? "—")}</span>
                            </span>
                          ) : (
                            <span className="strong">{String(r[spec.columns[0].k] ?? "—")}</span>
                          )}
                        </td>
                        <td className="t-actions"><button className="btn-sm" onClick={() => doUnarchive(r.id)}>Unarchive</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {editing && (
        <EntityForm
          spec={spec}
          record={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onCreate={async (v) => { await create(v); toast(`Added ${spec.singular}`); setEditing(null); }}
          onUpdate={update}
          onArchive={async (id) => { await update(id, { archived: true }); toast("Archived"); setEditing(null); if (archivedRows !== null) setArchivedRows(await fetchArchived()); }}
          onDelete={async (id) => { await remove(id); toast("Deleted"); setEditing(null); }}
        />
      )}

      {essaysFor && (
        <SupplementPanel
          institution={essaysFor}
          parentType={spec.table === "summer_programs" ? "summer_program" : "college"}
          onClose={() => setEssaysFor(null)}
        />
      )}
    </>
  );
}

function EntityForm({
  spec, record, onClose, onCreate, onUpdate, onDelete, onArchive,
}: {
  spec: Spec;
  record: Row | null;
  onClose: () => void;
  onCreate: (v: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: string, v: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
}) {
  const isEdit = !!record;
  const [form, setForm] = useState<Record<string, string>>(() => toForm(spec, record || {}));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef(form);
  formRef.current = form;
  const dirty = useRef(false);

  // Flush any pending edit on unmount (Done / Esc / scrim) so the last keystrokes are never lost.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      if (isEdit && record && dirty.current) {
        dirty.current = false;
        onUpdate(record.id, fromForm(spec, formRef.current)).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: string, v: string) => {
    const next = { ...formRef.current, [k]: v };
    setForm(next);
    formRef.current = next;
    if (isEdit && record) {
      dirty.current = true;
      setSaveState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        try {
          await onUpdate(record.id, fromForm(spec, formRef.current));
          dirty.current = false;
          setSaveState("saved");
          if (savedTimer.current) clearTimeout(savedTimer.current);
          savedTimer.current = setTimeout(() => setSaveState("idle"), 1600);
        } catch (e) {
          setSaveState("error");
          setErr("Couldn't save — " + (e as Error).message);
        }
      }, 500);
    }
  };

  const submitNew = async () => {
    const missing = spec.fields.filter((f) => f.required && !(form[f.k] || "").trim());
    if (missing.length) { setErr(missing.map((f) => f.label).join(", ") + (missing.length > 1 ? " are required." : " is required.")); return; }
    try { await onCreate(fromForm(spec, form)); } catch (e) { setErr("Could not save — " + (e as Error).message); }
  };
  const recordName = record ? String(record[spec.columns[0].k] ?? record.name ?? spec.singular) : spec.singular;
  const doDelete = async () => {
    if (!record) return;
    try { await onDelete(record.id); } catch (e) { setConfirming(false); setErr("Delete failed — " + (e as Error).message); }
  };
  const doArchive = async () => {
    if (!record) return;
    try { await onArchive(record.id); } catch (e) { setErr("Archive failed — " + (e as Error).message); }
  };

  const footer = isEdit ? (
    <>
      {confirming ? (
        <span className="inline-confirm">
          <span className="muted" style={{ fontSize: 13 }}>Delete &ldquo;{recordName}&rdquo;?</span>
          <button className="btn-sm" onClick={() => setConfirming(false)}>Cancel</button>
          <button className="btn-sm danger" onClick={doDelete}>Delete</button>
        </span>
      ) : (
        <span className="inline-confirm">
          <button className="btn danger" onClick={() => setConfirming(true)}>Delete</button>
          <button className="btn" onClick={doArchive}>Archive</button>
        </span>
      )}
      <span style={{ flex: 1 }} />
      <span className="muted" style={{ fontSize: 13, alignSelf: "center", color: saveState === "error" ? "var(--danger)" : undefined }}>
        {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : saveState === "error" ? "Save failed" : ""}
      </span>
      <button className="btn primary" onClick={onClose}>Done</button>
    </>
  ) : (
    <>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" onClick={submitNew}>Add {spec.singular}</button>
    </>
  );

  return (
    <Modal open onClose={onClose} title={(isEdit ? "Edit " : "New ") + spec.singular} footer={footer} wide={spec.fields.length > 6}>
      <div className="form">
        {spec.fields.map((fl) => {
          const full = fl.type === "textarea" || fl.type === "tags" || fl.required;
          return (
            <div className={"field" + (full ? " full" : "")} key={fl.k}>
              <label htmlFor={"f-" + fl.k}>{fl.label}{fl.required && <span style={{ color: "var(--danger)" }}> *</span>}</label>
              {fl.type === "textarea" ? (
                <textarea id={"f-" + fl.k} required={fl.required} value={form[fl.k] || ""} onChange={(e) => set(fl.k, e.target.value)} />
              ) : fl.type === "select" ? (
                <select id={"f-" + fl.k} required={fl.required} value={form[fl.k] || ""} onChange={(e) => set(fl.k, e.target.value)}>
                  <option value="" />
                  {fl.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  id={"f-" + fl.k}
                  type={fl.type === "number" ? "number" : fl.type === "date" ? "date" : fl.type === "url" ? "url" : "text"}
                  required={fl.required}
                  value={form[fl.k] || ""}
                  onChange={(e) => set(fl.k, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{err}</div>}
    </Modal>
  );
}
