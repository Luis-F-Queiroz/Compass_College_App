"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", ic: "◎" },
  { href: "/colleges", label: "Colleges", ic: "❖" },
  { href: "/personal-statement", label: "Personal Statement", ic: "✎" },
  { href: "/tasks", label: "Tasks", ic: "✓" },
  { href: "/activities", label: "Activities", ic: "★" },
  { href: "/competitions", label: "Competitions", ic: "✪" },
  { href: "/summer_programs", label: "Summer Programs", ic: "❂" },
  { href: "/ideas", label: "Ideas", ic: "✦" },
  { href: "/profile", label: "Profile", ic: "◉" },
  { href: "/counselor", label: "Counselor", ic: "✉" },
  { href: "/sync", label: "Sync", ic: "⟳" },
  { href: "/settings", label: "Settings", ic: "⚙" },
];

function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <rect width="32" height="32" rx="7" fill="#0066cc" />
      <path d="M16 5 L19.2 16 L16 27 L12.8 16 Z" fill="#fff" />
      <path d="M5 16 L16 12.8 L27 16 L16 19.2 Z" fill="#fff" fillOpacity="0.5" />
    </svg>
  );
}

export default function Sidebar() {
  const path = usePathname() || "";
  const [open, setOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [path]);

  // While the drawer is open: lock body scroll and close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Mobile top bar (hidden on desktop) */}
      <header className="mtopbar">
        <button
          className="mtopbar-burger"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="app-sidebar"
          onClick={() => setOpen(true)}
        >
          <span /><span /><span />
        </button>
        <span className="mtopbar-brand"><Mark size={22} /> Compass</span>
      </header>

      {/* Scrim behind the drawer (mobile only) */}
      <div className={"side-scrim" + (open ? " show" : "")} onClick={() => setOpen(false)} aria-hidden />

      <aside id="app-sidebar" className={"side" + (open ? " open" : "")} aria-label="Primary navigation">
        <div className="brand">
          <span aria-hidden style={{ lineHeight: 0 }}><Mark size={26} /></span>
          <div>
            <span className="name">Compass</span>
            <span className="sub">College application hub</span>
          </div>
        </div>
        <button className="side-close" aria-label="Close menu" onClick={() => setOpen(false)}>✕</button>
        <nav className="nav" aria-label="Primary">
          {NAV.map((n) => {
            const active = path === n.href || path.startsWith(n.href + "/");
            return (
              <Link key={n.href} href={n.href} className={"nav-item" + (active ? " active" : "")} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}>
                {active && (
                  <motion.div layoutId="navActive" className="nav-pill" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                )}
                <span className="ic">{n.ic}</span>
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="side-foot">Saved automatically to the cloud</div>
      </aside>
    </>
  );
}
