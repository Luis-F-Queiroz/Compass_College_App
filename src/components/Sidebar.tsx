"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const NAV = [
  { href: "/dashboard", label: "Dashboard", ic: "◎" },
  { href: "/colleges", label: "Colleges", ic: "❖" },
  { href: "/essays", label: "Essays", ic: "✎" },
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

export default function Sidebar() {
  const path = usePathname() || "";
  return (
    <aside className="side">
      <div className="brand">
        <span aria-hidden style={{ lineHeight: 0 }}>
          <svg viewBox="0 0 32 32" width="26" height="26">
            <rect width="32" height="32" rx="7" fill="#0066cc" />
            <path d="M16 5 L19.2 16 L16 27 L12.8 16 Z" fill="#fff" />
            <path d="M5 16 L16 12.8 L27 16 L16 19.2 Z" fill="#fff" fillOpacity="0.5" />
          </svg>
        </span>
        <div>
          <span className="name">Compass</span>
          <span className="sub">College application hub</span>
        </div>
      </div>
      <nav className="nav" aria-label="Primary">
        {NAV.map((n) => {
          const active = path === n.href || path.startsWith(n.href + "/");
          return (
            <Link key={n.href} href={n.href} className={"nav-item" + (active ? " active" : "")} aria-current={active ? "page" : undefined}>
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
  );
}
