"use client";
import { useState } from "react";

function hashHue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
function initials(name: string) {
  const p = (name || "?").split(/\s+/).filter(Boolean);
  return (p.slice(0, 2).map((w) => w[0] || "").join("") || "?").toUpperCase();
}
function domainOf(url?: string | null) {
  if (!url) return "";
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Real college logo with a graceful monogram fallback.
 * Source priority: explicit logo_url → the real logo fetched from the website domain
 * (Google's favicon service) → initials monogram when no real logo resolves.
 */
export default function CollegeLogo({
  name,
  websiteUrl,
  logoUrl,
  size = 32,
}: {
  name: string;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const domain = domainOf(websiteUrl);
  const src = logoUrl || (domain ? `https://www.google.com/s2/favicons?sz=128&domain=${domain}` : "");
  const radius = size >= 40 ? 14 : 8;
  return (
    <span
      className="avwrap"
      style={{ width: size, height: size, borderRadius: radius, fontSize: Math.round(size * 0.4) }}
    >
      <span className="avfill" style={{ background: `hsl(${hashHue(name)},36%,52%)` }}>
        {initials(name)}
      </span>
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="avimg"
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
