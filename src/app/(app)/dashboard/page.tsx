"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import { supabase } from "@/lib/supabaseBrowser";
import { useAuth } from "@/components/AuthProvider";
import { buildICS, downloadICS } from "@/lib/ics";

type AnyRow = Record<string, any>;
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function daysUntil(s?: string | null): number | null {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  const t = new Date();
  const t0 = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((d.getTime() - t0.getTime()) / 86400000);
}
function fmtDate(s?: string | null) {
  if (!s) return "—";
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(s);
  return `${MO[+m[2] - 1]} ${+m[3]}, ${m[1]}`;
}
function fmtWhen(n: number | null) {
  if (n == null) return "";
  if (n < 0) return `${Math.abs(n)}d overdue`;
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  return `in ${n} days`;
}
const IN_PROGRESS = ["Planning to apply", "Not started", "In progress", "Considering"];

export default function Dashboard() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<{ colleges: AnyRow[]; essays: AnyRow[]; tasks: AnyRow[]; ideas: AnyRow[] } | null>(null);

  useEffect(() => {
    if (!session) { setData(null); return; }
    (async () => {
      const sb = supabase();
      const [c, e, t, i] = await Promise.all([
        sb.from("colleges").select("*"),
        sb.from("essays").select("*"),
        sb.from("tasks").select("*"),
        sb.from("ideas").select("*").order("captured_at", { ascending: false }),
      ]);
      setData({ colleges: c.data || [], essays: e.data || [], tasks: t.data || [], ideas: i.data || [] });
    })();
  }, [session]);

  if (loading) return (
    <>
      <div className="topbar"><div><h1>Dashboard</h1></div></div>
      <div className="kpis">
        {[0, 1, 2, 3, 4].map((i) => (
          <div className="kpi" key={i}>
            <span className="skel" style={{ height: 30, width: "45%" }} />
            <span className="skel" style={{ height: 12, width: "78%", marginTop: 10 }} />
          </div>
        ))}
      </div>
      <div className="card"><div className="card-b">{[0, 1, 2].map((i) => <span key={i} className="skel skel-row" style={{ width: i ? "60%" : "82%" }} />)}</div></div>
    </>
  );

  if (!session) return (
    <>
      <div className="topbar"><div><h1>Dashboard</h1></div></div>
      <div className="card"><div className="card-b"><div className="empty">Loading your workspace…</div></div></div>
    </>
  );

  const d = data;
  const openTasks = (d?.tasks || []).filter((t) => t.status !== "Done");
  const overdue = openTasks.filter((t) => { const n = daysUntil(t.due_date); return n != null && n < 0; });
  const today = openTasks.filter((t) => daysUntil(t.due_date) === 0);
  const essaysNotFinal = (d?.essays || []).filter((e) => e.status !== "Final");
  const inProgress = (d?.colleges || []).filter((c) => IN_PROGRESS.includes(c.application_status));

  const items: { date: string; label: string; type: string; days: number | null }[] = [];
  (d?.colleges || []).forEach((c) => {
    if (c.deadline) items.push({ date: c.deadline, label: `${c.name} — Application`, type: "Application", days: daysUntil(c.deadline) });
    if (c.financial_aid_deadline) items.push({ date: c.financial_aid_deadline, label: `${c.name} — Financial aid`, type: "Financial aid", days: daysUntil(c.financial_aid_deadline) });
  });
  (d?.essays || []).forEach((e) => { if (e.deadline) items.push({ date: e.deadline, label: e.title, type: "Essay", days: daysUntil(e.deadline) }); });
  (d?.tasks || []).forEach((t) => { if (t.due_date && t.status !== "Done") items.push({ date: t.due_date, label: t.title, type: "Task", days: daysUntil(t.due_date) }); });
  const upcoming = items.filter((i) => i.days != null && i.days >= 0).sort((a, b) => a.days! - b.days!);
  const next90 = upcoming.filter((i) => (i.days as number) <= 90);
  const daysToNext = upcoming.length ? upcoming[0].days : null;
  const recentIdeas = (d?.ideas || []).slice(0, 5);

  // Per-college supplement progress: supplements link to a college via parent_type/parent_id.
  const suppProgress = (d?.colleges || [])
    .map((c) => {
      const es = (d?.essays || []).filter((e) => e.parent_type === "college" && e.parent_id === c.id && !e.archived);
      const final = es.filter((e) => e.status === "Final").length;
      return { id: c.id as string, name: String(c.name), total: es.length, final };
    })
    .filter((x) => x.total > 0)
    .sort((a, b) => a.final / a.total - b.final / b.total || b.total - a.total);

  const exportICS = () => {
    // Stable UID per deadline (date+type+label) so re-exporting updates events instead of duplicating them.
    const events = upcoming.map((i) => {
      const slug = `${i.date}-${i.type}-${i.label}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48);
      return { uid: `compass-${slug}@compass`, title: i.label, date: i.date, desc: i.type };
    });
    downloadICS("compass-deadlines.ics", buildICS(events));
  };

  const kpis: { v: number | string; l: string; alert?: boolean; href?: string }[] = [
    { v: daysToNext == null ? "None" : daysToNext, l: "Days to next deadline" },
    { v: today.length, l: "Tasks due today", href: "/tasks" },
    { v: overdue.length, l: "Overdue tasks", alert: overdue.length > 0, href: "/tasks" },
    { v: inProgress.length, l: "Applications in progress", href: "/colleges" },
    { v: essaysNotFinal.length, l: "Essays not final" },
  ];

  const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
  const item: Variants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: "easeOut" } } };
  return (
    <>
      <div className="topbar"><div><h1>Dashboard</h1></div></div>
      <motion.div className="kpis" variants={stagger} initial="hidden" animate="show">
        {kpis.map((k) => (
          <motion.div
            className={"kpi" + (k.href ? " kpi-link" : "")}
            key={k.l}
            variants={item}
            role={k.href ? "link" : undefined}
            tabIndex={k.href ? 0 : undefined}
            onClick={k.href ? () => router.push(k.href!) : undefined}
            onKeyDown={k.href ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(k.href!); } } : undefined}
          >
            <div className="v" style={k.alert ? { color: "var(--danger)" } : undefined}>{k.v}</div>
            <div className="l">{k.l}</div>
          </motion.div>
        ))}
      </motion.div>
      <motion.div className="dash-cols" variants={stagger} initial="hidden" animate="show">
        <motion.div className="card" variants={item} style={{ marginTop: 0 }}>
          <div className="card-h">
            <h3>Upcoming deadlines</h3>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {upcoming.length > 0 && <button className="btn-sm" onClick={exportICS} title="Download all upcoming deadlines as a calendar file">Export .ics</button>}
              <span className="muted" style={{ fontSize: 13 }}>Next 90 days</span>
            </span>
          </div>
          <div className="card-b">
            {next90.length ? next90.map((i, idx) => (
              <div className="listrow" key={idx}>
                <div className="grow"><div className="ttl">{i.label}</div><div className="meta">{i.type} · {fmtWhen(i.days)} · {fmtDate(i.date)}</div></div>
              </div>
            )) : <div className="empty">No deadlines in the next 90 days.</div>}
          </div>
        </motion.div>
        <motion.div className="card" variants={item} style={{ marginTop: 0 }}>
          <div className="card-h"><h3>Recent ideas</h3></div>
          <div className="card-b">
            {recentIdeas.length ? recentIdeas.map((i) => (
              <div className="listrow" key={i.id}><div className="grow"><div className="ttl">{String(i.text).slice(0, 90)}</div><div className="meta">{i.status}</div></div></div>
            )) : <div className="empty">No ideas yet.</div>}
          </div>
        </motion.div>
      </motion.div>

      {suppProgress.length > 0 && (
        <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: "easeOut" }}>
          <div className="card-h"><h3>Supplement progress</h3><span className="muted" style={{ fontSize: 13 }}>Final / total per school</span></div>
          <div className="card-b">
            {suppProgress.map((s) => (
              <div className="supp-prog-row" key={s.id}>
                <span className="supp-prog-name">{s.name}</span>
                <span className="supp-prog-bar"><span className="supp-prog-fill" style={{ width: `${Math.round((s.final / s.total) * 100)}%` }} /></span>
                <span className="supp-prog-count muted">{s.final}/{s.total} final</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </>
  );
}
