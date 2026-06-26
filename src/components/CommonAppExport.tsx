"use client";
/* Common App "Activities" export: maps the Activities table to the 10-slot Common App format
   with the official character limits flagged, and a one-click copy. Read-only view of the data. */
import { useState } from "react";
import Modal from "@/components/Modal";
import { supabase } from "@/lib/supabaseBrowser";
import { useToast } from "@/components/Toast";

type Act = {
  name: string;
  organization: string | null;
  role: string | null;
  hours_per_week: number | null;
  weeks_per_year: number | null;
  impact_achievements: string | null;
  description: string | null;
};

// Common App field character limits.
const LIMITS = { position: 50, org: 100, desc: 150 };

function slot(a: Act) {
  return {
    position: (a.role ?? "").trim(),
    org: (a.organization ?? "").trim(),
    desc: (a.impact_achievements ?? a.description ?? "").trim(),
    hpw: a.hours_per_week == null ? "" : String(a.hours_per_week),
    wpy: a.weeks_per_year == null ? "" : String(a.weeks_per_year),
  };
}

export default function CommonAppExport() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Act[] | null>(null);
  const toast = useToast();

  const openModal = async () => {
    setOpen(true);
    if (rows) return;
    const { data } = await supabase()
      .from("activities")
      .select("name,organization,role,hours_per_week,weeks_per_year,impact_achievements,description")
      .eq("archived", false);
    // Order by a rough impact proxy (hours × weeks) so the strongest activities fill the first 10 slots.
    const list = ((data as Act[]) ?? []).sort(
      (a, b) => (b.hours_per_week ?? 0) * (b.weeks_per_year ?? 0) - (a.hours_per_week ?? 0) * (a.weeks_per_year ?? 0),
    );
    setRows(list);
  };

  const copyAll = async () => {
    if (!rows) return;
    const text = rows
      .map((a, i) => {
        const s = slot(a);
        return [
          `Activity ${i + 1}: ${a.name}`,
          `  Position/Leadership: ${s.position}`,
          `  Organization: ${s.org}`,
          `  Hours/week: ${s.hpw}   Weeks/year: ${s.wpy}`,
          `  Description: ${s.desc}`,
        ].join("\n");
      })
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied all activities");
    } catch {
      toast("Couldn't copy — select the text and copy manually");
    }
  };

  const footer = (
    <>
      <span className="muted" style={{ fontSize: 13, alignSelf: "center" }}>
        {rows ? `${rows.length} activit${rows.length === 1 ? "y" : "ies"}` : ""}
        {rows && rows.length > 10 ? " · Common App allows 10" : ""}
      </span>
      <span style={{ flex: 1 }} />
      <button className="btn" onClick={() => setOpen(false)}>Close</button>
      <button className="btn primary" onClick={copyAll} disabled={!rows || rows.length === 0}>Copy all</button>
    </>
  );

  return (
    <>
      <button className="btn" onClick={openModal}>Common App export</button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="Common App activities (10-slot)" footer={footer} wide>
          {!rows ? (
            <span className="skel skel-row" style={{ width: "60%" }} />
          ) : rows.length === 0 ? (
            <div className="empty">No activities yet — add them on the Activities page first.</div>
          ) : (
            <div className="ca-list">
              {rows.map((a, i) => {
                const s = slot(a);
                return (
                  <div key={i} className={"ca-slot" + (i >= 10 ? " ca-over" : "")}>
                    <div className="ca-slot-h">
                      <span className="ca-num">{i + 1}</span>
                      <span className="strong">{a.name}</span>
                      {i >= 10 && <span className="chip warn">beyond slot 10</span>}
                    </div>
                    <CaField label="Position/Leadership" value={s.position} lim={LIMITS.position} />
                    <CaField label="Organization" value={s.org} lim={LIMITS.org} />
                    <CaField label="Description" value={s.desc} lim={LIMITS.desc} />
                    <div className="ca-meta muted">Hours/week {s.hpw || "—"} · Weeks/year {s.wpy || "—"}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

function CaField({ label, value, lim }: { label: string; value: string; lim: number }) {
  const over = value.length > lim;
  return (
    <div className="ca-field">
      <span className="ca-label">{label}</span>
      <span className="ca-value">{value || <span className="muted">—</span>}</span>
      <span className={"ca-count" + (over ? " over" : "")}>{value.length}/{lim}</span>
    </div>
  );
}
