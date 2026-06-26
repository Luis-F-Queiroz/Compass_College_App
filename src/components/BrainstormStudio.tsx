"use client";
/* Multi-session brainstorming for the personal statement: named sessions saved to the user's
   account, guided brainstorming methods, plus a launcher for external visual-canvas apps. */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";

type Session = { id: string; name: string | null; method: string | null; content: string | null };

const METHODS: { id: string; name: string; hint: string }[] = [
  { id: "freewrite", name: "Freewrite", hint: "Set a 10-minute timer and write without stopping or editing — proudest moments, regrets, obsessions, an ordinary day. Volume first, polish never." },
  { id: "moments", name: "Small moments", hint: "List tiny, concrete scenes only you witnessed: a smell, a sentence someone said, a thing you did with your hands. Great essays grow from one small moment, not a big theme." },
  { id: "values", name: "Values inventory", hint: "List 8–10 things you genuinely care about. For each, write one moment that proves you live it — not just believe it." },
  { id: "sowhat", name: "“So what?” ladder", hint: "Take one story and ask “so what?” five times. Each answer goes deeper — from what happened, to what it meant, to what it says about how you see the world." },
  { id: "mindmap", name: "Mind-map", hint: "Put one word in the center (an interest, a person, a place). Branch out into memories, tensions, contradictions. Follow the branch that surprises you." },
  { id: "turning", name: "Turning point", hint: "Describe a moment you changed your mind, failed, or saw something differently. Admissions trust growth more than triumph — show the before and after." },
  { id: "onlyme", name: "Only I could write this", hint: "Write the paragraph nobody else in the applicant pool could. If a classmate could submit it too, get more specific." },
];
const APPS: { name: string; url: string }[] = [
  { name: "Excalidraw", url: "https://excalidraw.com/" },
  { name: "Miro", url: "https://miro.com/" },
  { name: "MindMeister", url: "https://www.mindmeister.com/" },
  { name: "Padlet", url: "https://padlet.com/" },
];

export default function BrainstormStudio() {
  const { session } = useAuth();
  const toast = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase().from("brainstorm_sessions").select("id,name,method,content").order("created_at", { ascending: true });
    const rows = (data as Session[]) ?? [];
    setSessions(rows);
    setActiveId((prev) => prev && rows.some((r) => r.id === prev) ? prev : rows[0]?.id ?? null);
    setLoading(false);
  }, [session]);
  useEffect(() => { load(); }, [load]);

  const active = sessions.find((s) => s.id === activeId) ?? null;

  const addSession = async () => {
    if (!session) return;
    const name = `Brainstorm ${sessions.length + 1}`;
    const { data } = await supabase().from("brainstorm_sessions").insert({ user_id: session.user.id, name, content: "" }).select("id,name,method,content").single();
    if (data) { setSessions((p) => [...p, data as Session]); setActiveId((data as Session).id); }
  };
  // Coalesce rapid edits to the SAME session (merge fields) so a later field change
  // doesn't cancel an earlier one's save; flush on unmount / before unload.
  const pendingRef = useRef<{ id: string; fields: Partial<Session> } | null>(null);
  const flush = useCallback(async () => {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    await supabase().from("brainstorm_sessions").update({ ...p.fields, updated_at: new Date().toISOString() }).eq("id", p.id);
    setSaveState("saved");
    setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1400);
  }, []);
  const patch = (id: string, fields: Partial<Session>) => {
    setSessions((p) => p.map((s) => (s.id === id ? { ...s, ...fields } : s)));
    const pend = pendingRef.current;
    if (pend && pend.id !== id) {
      // a different session had pending edits — flush them now so they aren't dropped
      supabase().from("brainstorm_sessions").update({ ...pend.fields, updated_at: new Date().toISOString() }).eq("id", pend.id);
    }
    pendingRef.current = { id, fields: pend && pend.id === id ? { ...pend.fields, ...fields } : fields };
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };
  useEffect(() => {
    const onBU = (e: BeforeUnloadEvent) => { if (pendingRef.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", onBU);
    return () => {
      window.removeEventListener("beforeunload", onBU);
      if (timer.current) clearTimeout(timer.current);
      if (pendingRef.current) flush();
    };
  }, [flush]);
  const del = async (id: string) => {
    await supabase().from("brainstorm_sessions").delete().eq("id", id);
    toast("Session removed");
    setActiveId(null);
    await load();
  };

  const method = METHODS.find((m) => m.id === active?.method) ?? null;

  return (
    <div className="card">
      <div className="card-h">
        <h3>Brainstorm</h3>
        <span className="muted" aria-live="polite" style={{ fontSize: 13 }}>{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : ""}</span>
      </div>
      <div className="card-b">
        <div className="bs-tabs">
          {sessions.map((s) => (
            <button key={s.id} className={"bs-tab" + (s.id === activeId ? " active" : "")} onClick={() => setActiveId(s.id)}>{s.name || "Untitled"}</button>
          ))}
          <button className="bs-tab add" onClick={addSession}>+ New session</button>
        </div>

        {loading ? (
          <span className="skel skel-row" style={{ width: "55%" }} />
        ) : !active ? (
          <div className="empty"><div className="big">No brainstorm sessions yet</div>Start one — try a different angle in each (Brainstorm 1, 2, 3…), all saved here.</div>
        ) : (
          <div className="bs-panel">
            <div className="bs-row">
              <input className="bs-name" aria-label="Session name" value={active.name ?? ""} onChange={(e) => patch(active.id, { name: e.target.value })} placeholder="Session name" />
              <button className="btn-sm danger" onClick={() => del(active.id)}>Delete</button>
            </div>

            <div className="bs-methods">
              {METHODS.map((m) => (
                <button key={m.id} className={"chip bs-method" + (active.method === m.id ? " on" : "")} aria-pressed={active.method === m.id} onClick={() => patch(active.id, { method: active.method === m.id ? null : m.id })}>{m.name}</button>
              ))}
            </div>
            {method && <div className="bs-hint">{method.hint}</div>}

            <textarea
              className="ps-brainstorm"
              value={active.content ?? ""}
              onChange={(e) => patch(active.id, { content: e.target.value })}
              placeholder={method ? "Work the method above — write freely." : "Pick a method above, or just dump everything here: proudest moments, a small specific story only you could tell, your through-line."}
            />

            <div className="bs-launch">
              <span className="muted" style={{ fontSize: 13 }}>Prefer a visual canvas? Open one in a new tab:</span>
              {APPS.map((a) => (
                <a key={a.name} className="btn-sm" href={a.url} target="_blank" rel="noopener noreferrer">{a.name} ↗</a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
