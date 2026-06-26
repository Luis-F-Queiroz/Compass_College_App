// College Board page shared bits: official logos (user-provided, served from /public/logos) + superscore.
export const SAT_LOGO = "/logos/sat-logo.png";
export const AP_LOGO = "/logos/ap-logo.png";
export const CB_WORDMARK = "/logos/collegeboard-logo.png";
export const CB_ICON = "/logos/collegeboard-icon.png";

export type Sitting = { id: string; label: string | null; test_date: string | null; rw: number | null; math: number | null };

/** SAT superscore = best Reading & Writing across sittings + best Math across sittings. */
export function superscore(sittings: { rw: number | null; math: number | null }[]) {
  const rws = sittings.map((s) => s.rw).filter((n): n is number => typeof n === "number");
  const maths = sittings.map((s) => s.math).filter((n): n is number => typeof n === "number");
  const bestRW = rws.length ? Math.max(...rws) : null;
  const bestMath = maths.length ? Math.max(...maths) : null;
  return { bestRW, bestMath, total: bestRW != null && bestMath != null ? bestRW + bestMath : null };
}
