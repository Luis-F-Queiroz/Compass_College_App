// College Board page shared bits: official sourced logos + the SAT superscore formula.
// Logos are the official wordmarks from Wikimedia Commons (exact fonts), not hand-drawn.
export const SAT_LOGO = "https://upload.wikimedia.org/wikipedia/commons/5/5a/SAT_logo_%282017%29.svg";
export const AP_LOGO = "https://upload.wikimedia.org/wikipedia/commons/7/7b/Advanced_Placement_logo_-_College_Board.svg";

export type Sitting = { id: string; label: string | null; test_date: string | null; rw: number | null; math: number | null };

/** SAT superscore = best Reading & Writing across sittings + best Math across sittings. */
export function superscore(sittings: { rw: number | null; math: number | null }[]) {
  const rws = sittings.map((s) => s.rw).filter((n): n is number => typeof n === "number");
  const maths = sittings.map((s) => s.math).filter((n): n is number => typeof n === "number");
  const bestRW = rws.length ? Math.max(...rws) : null;
  const bestMath = maths.length ? Math.max(...maths) : null;
  return { bestRW, bestMath, total: bestRW != null && bestMath != null ? bestRW + bestMath : null };
}
