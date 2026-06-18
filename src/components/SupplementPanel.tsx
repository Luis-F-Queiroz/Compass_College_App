"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/components/Modal";
import { supabase } from "@/lib/supabaseBrowser";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { ESSAY_STATUS } from "@/lib/specs";

type Essay = {
  id: string;
  title: string | null;
  prompt_text: string | null;
  word_limit: number | null;
  status: string | null;
  deadline: string | null;
  google_doc_url: string | null;
  is_reusable: boolean;
};

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (s: string | null) => {
  if (!s) return "";
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${M[+m[2] - 1]} ${+m[3]}` : String(s);
};

export default function SupplementPanel({
  institution,
  parentType,
  onClose,
}: {
  institution: any;
  parentType: "college" | "summer_program";
  onClose: () => void;
}) {
  const { session } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<Essay[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Essay | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase()
      .from("essays")
      .select("id,title,prompt_text,word_limit,status,deadline,google_doc_url,is_reusable")
      .eq("parent_type", parentType)
      .eq("parent_id", institution.id)
      .order("created_at", { ascending: true });
    setRows((data as Essay[]) ?? []);
    setLoading(false);
  }, [session, parentType, institution.id]);
  useEffect(() => {
    load();
  }, [load]);

  // Create (or open) the Google Doc for a supplement.
  const doDoc = async (e: Essay) => {
    if (e.google_doc_url) {
      window.open(e.google_doc_url, "_blank", "noopener");
      return;
    }
    setBusy(e.id);
    try {
      const res = await fetch("/api/create-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `${institution.name} — ${e.title || "Supplement"}` }),
      });
      const j = await res.json();
      if (!res.ok || !j.url) {
        toast(j.error || "Couldn't create the Google Doc");
        return;
      }
      await supabase().from("essays").update({ google_doc_url: j.url }).eq("id", e.id);
      await load();
      window.open(j.url, "_blank", "noopener");
    } catch {
      toast("Couldn't reach the doc service");
    } finally {
      setBusy(null);
    }
  };

  const del = async (id: string) => {
    await supabase().from("essays").delete().eq("id", id);
    toast("Removed");
    await load();
  };

  if (form !== null) {
    return <SupplementForm institution={institution} parentType={parentType} record={form === "new" ? null : form} onBack={async () => { setForm(null); await load(); }} onClose={onClose} />;
  }

  const footer = (
    <>
      <button className="btn" onClick={onClose}>Close</button>
      <span style={{ flex: 1 }} />
      <button className="btn primary" onClick={() => setForm("new")}>+ Add supplement</button>
    </>
  );

  return (
    <Modal open onClose={onClose} title={`Essays — ${institution.name}`} footer={footer} wide>
      {loading ? (
        <span className="skel skel-row" style={{ width: "70%" }} />
      ) : rows.length === 0 ? (
        <div className="empty"><div className="big">No supplements yet</div>Add this school&apos;s supplemental prompts.</div>
      ) : (
        <div className="supp-list">
          {rows.map((e) => (
            <div key={e.id} className="supp-item">
              <div className="supp-head">
                <span className="strong">{e.title || "Untitled supplement"}</span>
                {e.status && <span className="chip dim">{e.status}</span>}
                {e.word_limit != null && <span className="chip dim">≤ {e.word_limit} words</span>}
                {e.is_reusable && <span className="chip ok">Reusable</span>}
                {e.deadline && <span className="muted" style={{ fontSize: 12 }}>{fmtDate(e.deadline)}</span>}
              </div>
              {e.prompt_text && <p className="supp-prompt">{e.prompt_text}</p>}
              <div className="supp-actions">
                <button className="btn-sm primary" disabled={busy === e.id} onClick={() => doDoc(e)}>
                  {busy === e.id ? "…" : e.google_doc_url ? "Open Google Doc" : "Create Google Doc"}
                </button>
                <button className="btn-sm" onClick={() => setForm(e)}>Edit</button>
                <button className="btn-sm danger" onClick={() => del(e.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function SupplementForm({
  institution,
  parentType,
  record,
  onBack,
  onClose,
}: {
  institution: any;
  parentType: "college" | "summer_program";
  record: Essay | null;
  onBack: () => void;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({
    title: record?.title ?? "",
    prompt_text: record?.prompt_text ?? "",
    word_limit: record?.word_limit != null ? String(record.word_limit) : "",
    status: record?.status ?? "",
    deadline: record?.deadline ?? "",
    is_reusable: record?.is_reusable ?? false,
  });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const saving = useRef(false);

  const save = async () => {
    if (!session || saving.current) return;
    if (!f.title.trim()) { setErr("Give the supplement a name (the prompt topic)."); return; }
    saving.current = true;
    const payload = {
      title: f.title.trim(),
      prompt_text: f.prompt_text.trim() || null,
      word_limit: f.word_limit.trim() === "" ? null : Number(f.word_limit),
      status: f.status || null,
      deadline: f.deadline || null,
      is_reusable: f.is_reusable,
      parent_type: parentType,
      parent_id: institution.id,
    };
    try {
      if (record) await supabase().from("essays").update(payload).eq("id", record.id);
      else await supabase().from("essays").insert({ ...payload, user_id: session.user.id });
      toast(record ? "Saved" : "Supplement added");
      onBack();
    } catch (e) {
      setErr("Could not save — " + (e as Error).message);
    } finally {
      saving.current = false;
    }
  };

  const footer = (
    <>
      <button className="btn" onClick={onBack}>Back</button>
      <span style={{ flex: 1 }} />
      <button className="btn primary" onClick={save}>{record ? "Save" : "Add supplement"}</button>
    </>
  );

  return (
    <Modal open onClose={onClose} title={`${record ? "Edit" : "New"} supplement — ${institution.name}`} footer={footer} wide>
      <div className="form">
        <div className="field full">
          <label htmlFor="s-title">Name (the prompt topic, e.g. &quot;Why this school?&quot;)</label>
          <input id="s-title" value={f.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="field full">
          <label htmlFor="s-prompt">Exact prompt</label>
          <textarea id="s-prompt" value={f.prompt_text} onChange={(e) => set("prompt_text", e.target.value)} style={{ minHeight: 80 }} />
        </div>
        <div className="field">
          <label htmlFor="s-wl">Word limit</label>
          <input id="s-wl" type="number" value={f.word_limit} onChange={(e) => set("word_limit", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="s-status">Status</label>
          <select id="s-status" value={f.status} onChange={(e) => set("status", e.target.value)}>
            <option value="" />
            {ESSAY_STATUS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="s-deadline">Deadline</label>
          <input id="s-deadline" type="date" value={f.deadline} onChange={(e) => set("deadline", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="s-reuse">Reusable across schools</label>
          <label className="check-row"><input id="s-reuse" type="checkbox" checked={f.is_reusable} onChange={(e) => set("is_reusable", e.target.checked)} /> Mark as reusable</label>
        </div>
      </div>
      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{err}</div>}
    </Modal>
  );
}
