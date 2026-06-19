"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/components/Modal";
import { supabase } from "@/lib/supabaseBrowser";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { ESSAY_STATUS } from "@/lib/specs";

type Draft = {
  id: string;
  title: string | null;
  status: string | null;
  word_limit: number | null;
  google_doc_url: string | null;
  brainstorm_notes: string | null;
};

export default function PersonalStatement() {
  const { session } = useAuth();
  const toast = useToast();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [brainstorm, setBrainstorm] = useState("");
  const [bsState, setBsState] = useState<"idle" | "saving" | "saved">("idle");
  const [editing, setEditing] = useState<Draft | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const bsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const [d, cfg] = await Promise.all([
      supabase().from("essays").select("id,title,status,word_limit,google_doc_url,brainstorm_notes").eq("parent_type", "personal").order("created_at", { ascending: true }),
      supabase().from("app_config").select("ps_brainstorm").eq("user_id", session.user.id).maybeSingle(),
    ]);
    setDrafts((d.data as Draft[]) ?? []);
    setBrainstorm((cfg.data as any)?.ps_brainstorm ?? "");
    setLoading(false);
  }, [session]);
  useEffect(() => {
    load();
  }, [load]);

  const saveBrainstorm = (v: string) => {
    setBrainstorm(v);
    setBsState("saving");
    if (bsTimer.current) clearTimeout(bsTimer.current);
    bsTimer.current = setTimeout(async () => {
      if (!session) return;
      await supabase().from("app_config").upsert({ user_id: session.user.id, ps_brainstorm: v }, { onConflict: "user_id" });
      setBsState("saved");
      setTimeout(() => setBsState("idle"), 1500);
    }, 600);
  };

  const doDoc = async (d: Draft) => {
    if (d.google_doc_url) {
      window.open(d.google_doc_url, "_blank", "noopener");
      return;
    }
    setBusy(d.id);
    try {
      const res = await fetch("/api/create-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Personal Statement — ${d.title || "Draft"}` }),
      });
      const j = await res.json();
      if (!res.ok || !j.url) {
        toast(j.error || "Couldn't create the Google Doc");
        return;
      }
      await supabase().from("essays").update({ google_doc_url: j.url }).eq("id", d.id);
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

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Personal Statement</h1>
          <p className="crumb">One essay, the same for every college — submitted through the Common App.</p>
        </div>
        <div className="toolbar">
          <a className="btn commonapp" href="https://www.commonapp.org" target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://www.google.com/s2/favicons?sz=64&domain=commonapp.org" alt="" width="18" height="18" style={{ borderRadius: 4 }} />
            Common App
          </a>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h3>Brainstorm</h3>
          <span className="muted" style={{ fontSize: 13 }}>{bsState === "saving" ? "Saving…" : bsState === "saved" ? "Saved ✓" : ""}</span>
        </div>
        <div className="card-b">
          <textarea
            className="ps-brainstorm"
            value={brainstorm}
            onChange={(e) => saveBrainstorm(e.target.value)}
            placeholder="Dump everything here — proudest moments, a small specific story only you could tell, your through-line, what you'd want a stranger to understand about you. No structure needed yet; this is just for you."
          />
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h3>Drafts</h3></div>
        <div className="card-b" style={{ paddingTop: 10 }}>
          {loading ? (
            <span className="skel skel-row" style={{ width: "60%" }} />
          ) : drafts.length === 0 ? (
            <div className="empty"><div className="big">No drafts yet</div>Start a draft — each can have its own Google Doc, so you can try different angles.</div>
          ) : (
            <div className="supp-list">
              {drafts.map((d) => (
                <div key={d.id} className="supp-item">
                  <div className="supp-head">
                    <span className="strong">{d.title || "Untitled draft"}</span>
                    {d.status && <span className="chip dim">{d.status}</span>}
                    <span className="chip dim">≤ {d.word_limit ?? 650} words</span>
                  </div>
                  {d.brainstorm_notes && <p className="supp-prompt">{d.brainstorm_notes}</p>}
                  <div className="supp-actions">
                    <button className="btn-sm primary" disabled={busy === d.id} onClick={() => doDoc(d)}>
                      {busy === d.id ? "…" : d.google_doc_url ? "Open Google Doc" : "Create Google Doc"}
                    </button>
                    <button className="btn-sm" onClick={() => setEditing(d)}>Edit</button>
                    <button className="btn-sm danger" onClick={() => del(d.id)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 14 }}><button className="btn primary" onClick={() => setEditing("new")}>+ New draft</button></div>
        </div>
      </div>

      {editing !== null && (
        <DraftModal record={editing === "new" ? null : editing} userId={session?.user.id || ""} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />
      )}
    </>
  );
}

function DraftModal({ record, userId, onClose, onSaved }: { record: Draft | null; userId: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    title: record?.title ?? "",
    status: record?.status ?? "",
    word_limit: record?.word_limit != null ? String(record.word_limit) : "650",
    brainstorm_notes: record?.brainstorm_notes ?? "",
  });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.title.trim()) { setErr("Give the draft a name (e.g. an angle)."); return; }
    const payload = {
      title: f.title.trim(),
      status: f.status || null,
      word_limit: f.word_limit.trim() === "" ? null : Number(f.word_limit),
      brainstorm_notes: f.brainstorm_notes.trim() || null,
      parent_type: "personal",
    };
    try {
      if (record) await supabase().from("essays").update(payload).eq("id", record.id);
      else await supabase().from("essays").insert({ ...payload, user_id: userId });
      toast(record ? "Saved" : "Draft added");
      onSaved();
    } catch (e) {
      setErr("Could not save — " + (e as Error).message);
    }
  };

  const footer = (
    <>
      <button className="btn" onClick={onClose}>Cancel</button>
      <span style={{ flex: 1 }} />
      <button className="btn primary" onClick={save}>{record ? "Save" : "Add draft"}</button>
    </>
  );

  return (
    <Modal open onClose={onClose} title={record ? "Edit draft" : "New draft"} footer={footer} wide>
      <div className="form">
        <div className="field full">
          <label htmlFor="d-title">Draft name / angle</label>
          <input id="d-title" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Draft 2 — the debate-coach angle" />
        </div>
        <div className="field">
          <label htmlFor="d-status">Status</label>
          <select id="d-status" value={f.status} onChange={(e) => set("status", e.target.value)}>
            <option value="" />
            {ESSAY_STATUS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="d-wl">Word limit</label>
          <input id="d-wl" type="number" value={f.word_limit} onChange={(e) => set("word_limit", e.target.value)} />
        </div>
        <div className="field full">
          <label htmlFor="d-notes">Notes</label>
          <textarea id="d-notes" value={f.brainstorm_notes} onChange={(e) => set("brainstorm_notes", e.target.value)} style={{ minHeight: 70 }} placeholder="What this angle is about, what's working, what to fix next…" />
        </div>
      </div>
      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{err}</div>}
    </Modal>
  );
}
