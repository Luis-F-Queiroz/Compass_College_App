"use client";
/* First-run welcome. Shown once per browser (localStorage gated); dismissing marks it seen. */
import { useEffect, useState } from "react";
import Modal from "@/components/Modal";

const KEY = "compass_onboarded_v1";
const STEPS: [string, string][] = [
  ["Colleges", "Your school list — research, deadlines, supplements, and portals. Click a row for the full profile."],
  ["Personal Statement", "Your Common App essay: brainstorm sessions, drafts, and a Google Doc launcher."],
  ["College Board", "Your live SAT superscore and AP scores."],
  ["Tasks & Competitions", "What's due next, and your competition pipeline."],
  ["Sync", "Everything flows from CoWork → validated → here. CoWork stays the source of truth."],
];

export default function Onboarding() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      /* localStorage unavailable — skip onboarding rather than crash */
    }
  }, []);
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };
  if (!show) return null;
  return (
    <Modal
      open
      onClose={dismiss}
      title="Welcome to Compass"
      footer={<><span style={{ flex: 1 }} /><button className="btn primary" onClick={dismiss}>Get started</button></>}
    >
      <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
        Your command center for the whole application. A quick tour of where things live — press ⌘K anytime to search.
      </p>
      <div className="ob-list">
        {STEPS.map(([h, d]) => (
          <div className="ob-row" key={h}>
            <span className="ob-h">{h}</span>
            <span className="ob-d">{d}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
