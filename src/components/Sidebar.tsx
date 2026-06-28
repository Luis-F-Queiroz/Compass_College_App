"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", ic: "dashboard" },
  { href: "/colleges", label: "Colleges", ic: "colleges" },
  { href: "/personal-statement", label: "Personal Statement", ic: "personal-statement" },
  { href: "/college-board", label: "College Board", ic: "college-board" },
  { href: "/tasks", label: "Tasks", ic: "tasks" },
  { href: "/activities", label: "Activities", ic: "activities" },
  { href: "/competitions", label: "Competitions", ic: "competitions" },
  { href: "/summer_programs", label: "Summer Programs", ic: "summer" },
  { href: "/scholarships", label: "Scholarships", ic: "scholarships" },
  { href: "/ideas", label: "Ideas", ic: "ideas" },
  { href: "/profile", label: "Profile", ic: "profile" },
  { href: "/counselor", label: "Counselor", ic: "counselor" },
  { href: "/sync", label: "Sync", ic: "sync" },
  { href: "/settings", label: "Settings", ic: "settings" },
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

// Line icons for the page-selection nav. Monochrome, inherit the nav text color (currentColor),
// thin round strokes — matched to the app's existing icon weight.
function NavIcon({ name }: { name: string }) {
  // College Board (acorn) and Personal Statement (Common App) use the official brand marks,
  // rendered as a currentColor mask of the white PNG so they dim/brighten with the nav state
  // exactly like the line icons — the shape is the brand mark's, the color follows the design system.
  if (name === "college-board" || name === "personal-statement") {
    return <span className={"nav-mask nav-mask-" + name} aria-hidden />;
  }
  const body = (() => {
    switch (name) {
      case "dashboard":
        return (<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>);
      case "colleges": // graduation cap
        return (<><path d="M3 9l9-4 9 4-9 4-9-4z" /><path d="M7 11v4.5c0 0 2 1.8 5 1.8s5-1.8 5-1.8V11" /><path d="M21 9v4.5" /></>);
      case "tasks": // checkbox with check
        return (<><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="M8 12l3 3 5-6" /></>);
      case "activities": // star
        return (<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" />);
      case "competitions": // trophy
        return (<><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2z" /></>);
      case "summer": // sun
        return (<><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="M4.93 4.93l1.41 1.41" /><path d="M17.66 17.66l1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="M6.34 17.66l-1.41 1.41" /><path d="M19.07 4.93l-1.41 1.41" /></>);
      case "scholarships": // dollar in a circle (funding/award)
        return (<><circle cx="12" cy="12" r="9.5" /><path d="M15.5 8.5h-4a2 2 0 1 0 0 4h1a2 2 0 1 1 0 4h-4" /><path d="M12 7v1.5" /><path d="M12 16v1.5" /></>);
      case "ideas": // lightbulb
        return (<><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5" /></>);
      case "profile": // single person (torso-up)
        return (<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>);
      case "counselor": // two people
        return (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>);
      case "sync": // circular arrows
        return (<><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></>);
      case "settings": // gear
        return (<><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></>);
      default:
        return null;
    }
  })();
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{body}</svg>
  );
}

export default function Sidebar() {
  const path = usePathname() || "";
  const [open, setOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [path]);

  // Return focus to the hamburger when the drawer closes (after having been opened).
  useEffect(() => {
    if (open) opened.current = true;
    else if (opened.current) burgerRef.current?.focus();
  }, [open]);

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
          ref={burgerRef}
          className="mtopbar-burger"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="app-sidebar"
          onClick={() => setOpen(true)}
        >
          <span /><span /><span />
        </button>
        <span className="mtopbar-brand"><Mark size={22} /> Luis Queiroz</span>
      </header>

      {/* Scrim behind the drawer (mobile only) */}
      <div className={"side-scrim" + (open ? " show" : "")} onClick={() => setOpen(false)} aria-hidden />

      <aside id="app-sidebar" className={"side" + (open ? " open" : "")} aria-label="Primary navigation">
        <div className="brand">
          <span aria-hidden style={{ lineHeight: 0 }}><Mark size={26} /></span>
          <div>
            <span className="name">Luis Queiroz</span>
            <span className="sub">Compass</span>
          </div>
        </div>
        <button className="side-close" aria-label="Close menu" onClick={() => setOpen(false)}>✕</button>
        <button className="side-search" onClick={() => window.dispatchEvent(new Event("compass:search"))}>
          <span className="ic" aria-hidden>⌕</span>
          <span>Search</span>
          <span className="side-search-k" aria-hidden>⌘K</span>
        </button>
        <nav className="nav" aria-label="Primary">
          {NAV.map((n) => {
            const active = path === n.href || path.startsWith(n.href + "/");
            return (
              <Link key={n.href} href={n.href} className={"nav-item" + (active ? " active" : "")} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}>
                {active && (
                  <motion.div layoutId="navActive" className="nav-pill" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                )}
                <span className="ic"><NavIcon name={n.ic} /></span>
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
