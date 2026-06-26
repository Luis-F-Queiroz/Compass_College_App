"use client";
/* Global search / command palette. Opens on ⌘K / Ctrl-K (or the sidebar Search button via a
   custom "compass:search" event). Indexes the main entities and jumps to them. Colleges deep-link
   to their detail page; other entities jump to their list page. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";
import { useAuth } from "@/components/AuthProvider";

declare global {
  interface WindowEventMap {
    "compass:search": Event;
  }
}

type Item = { type: string; label: string; href: string; id: string };

const SOURCES: { table: string; type: string; field: string; href: (r: any) => string }[] = [
  { table: "colleges", type: "College", field: "name", href: (r) => `/colleges/${r.id}` },
  { table: "tasks", type: "Task", field: "title", href: () => "/tasks" },
  { table: "activities", type: "Activity", field: "name", href: () => "/activities" },
  { table: "competitions", type: "Competition", field: "name", href: () => "/competitions" },
  { table: "summer_programs", type: "Summer program", field: "name", href: () => "/summer_programs" },
  { table: "ideas", type: "Idea", field: "text", href: () => "/ideas" },
  { table: "scholarship_deadlines", type: "Scholarship", field: "label", href: () => "/scholarships" },
];

export default function CommandPalette() {
  const { session } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState<Item[] | null>(null);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build the search index once, on first open.
  const buildIndex = useCallback(async () => {
    if (!session) return;
    const sb = supabase();
    const results = await Promise.all(
      SOURCES.map((s) =>
        sb.from(s.table).select("*").eq("archived", false).then((r: any) => ({ s, rows: (r.data as any[]) ?? [] })),
      ),
    );
    const items: Item[] = [];
    for (const { s, rows } of results) {
      for (const row of rows) {
        const label = row[s.field];
        if (label == null || String(label).trim() === "") continue;
        items.push({ type: s.type, label: String(label), href: s.href(row), id: String(row.id) });
      }
    }
    setIndex(items);
  }, [session]);

  // ⌘K / Ctrl-K toggle, Escape to close, and the sidebar's custom open event.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onEvt = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("compass:search", onEvt);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("compass:search", onEvt);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setSel(0);
    if (!index) buildIndex();
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open, index, buildIndex]);

  const results = useMemo(() => {
    if (!index) return [];
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return index.filter((i) => i.label.toLowerCase().includes(term)).slice(0, 24);
  }, [index, q]);

  useEffect(() => {
    setSel(0);
  }, [q]);

  const go = (i: Item) => {
    setOpen(false);
    router.push(i.href);
  };

  const onInputKey = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => (results.length === 0 ? 0 : Math.min(s + 1, results.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[sel]) go(results[sel]);
    }
  };

  if (!open) return null;
  return (
    <div className="cmdk-scrim" onClick={() => setOpen(false)}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Search">
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder="Search colleges, tasks, activities…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onInputKey}
          aria-label="Search"
        />
        <div className="cmdk-list">
          {!index ? (
            <div className="cmdk-empty">Loading…</div>
          ) : q.trim() === "" ? (
            <div className="cmdk-empty">Type to search across your workspace.</div>
          ) : results.length === 0 ? (
            <div className="cmdk-empty">No matches for &ldquo;{q}&rdquo;.</div>
          ) : (
            results.map((i, idx) => (
              <button
                key={i.type + ":" + i.id}
                className={"cmdk-item" + (idx === sel ? " sel" : "")}
                onMouseEnter={() => setSel(idx)}
                onClick={() => go(i)}
              >
                <span className="cmdk-label">{i.label}</span>
                <span className="cmdk-type">{i.type}</span>
              </button>
            ))
          )}
        </div>
        <div className="cmdk-foot"><span className="muted">↑↓ to navigate · ↵ to open · esc to close</span></div>
      </div>
    </div>
  );
}
