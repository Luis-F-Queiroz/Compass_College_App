// "Learn More" per-college research framework — grouped sections + grade/target color helpers.
// Mirrors Luis's Excel sheet (location/climate, grades, majors, target status, etc.).

export const GRADES = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"];
export const TARGET = ["Target", "Semi-target", "Non-target"];

export type DType = "text" | "long" | "number" | "grade" | "target";
export type DField = { k: string; label: string; type: DType };

export const DETAIL_SECTIONS: { title: string; fields: DField[] }[] = [
  {
    title: "Location",
    fields: [
      { k: "location_climate_population", label: "Location, climate & population", type: "long" },
      { k: "location_grade", label: "Location grade", type: "grade" },
    ],
  },
  {
    title: "Academics",
    fields: [
      { k: "majors", label: "Majors", type: "long" },
      { k: "minors", label: "Minors", type: "long" },
      { k: "major_classes", label: "Major classes", type: "long" },
      { k: "gen_ed_classes", label: "General-education classes", type: "long" },
      { k: "honors_and_programs", label: "Honors & programs", type: "long" },
      { k: "academic_grade", label: "Academic grade", type: "grade" },
    ],
  },
  {
    title: "Student life",
    fields: [
      { k: "student_body", label: "Student body", type: "long" },
      { k: "culture", label: "Culture", type: "long" },
      { k: "clubs", label: "Clubs", type: "long" },
      { k: "social_grade", label: "Social grade", type: "grade" },
      { k: "pros", label: "Pros", type: "long" },
      { k: "cons", label: "Cons", type: "long" },
    ],
  },
  {
    title: "After college",
    fields: [
      { k: "after_college", label: "After college", type: "long" },
      { k: "target_status", label: "Target status", type: "target" },
      { k: "value_grade", label: "Value grade", type: "grade" },
      { k: "business_school_rank", label: "Business school rank (#)", type: "number" },
      { k: "business_major_school", label: "Business major / school (Yes/No)", type: "text" },
    ],
  },
  {
    title: "Admissions",
    fields: [
      { k: "sat_range", label: "SAT range (mid 50%)", type: "text" },
      { k: "sat_median", label: "SAT median", type: "text" },
      { k: "acceptance_rate", label: "Acceptance rate (%)", type: "number" },
      { k: "overall_grade", label: "Overall grade", type: "grade" },
    ],
  },
];

// Color scheme mirrors the Excel (green/amber/red) using the app's semantic chip tokens.
export function gradeChip(g?: string | null) {
  if (!g) return "dim";
  const x = String(g).trim().toUpperCase();
  if (x.startsWith("A")) return "ok";
  if (x.startsWith("B")) return "blue";
  if (x.startsWith("C")) return "warn";
  return "danger"; // D, F
}
export function targetChip(t?: string | null) {
  if (!t) return "dim";
  const x = String(t).toLowerCase();
  if (x.startsWith("target")) return "ok";
  if (x.startsWith("semi")) return "warn";
  return "danger"; // non-target
}
export function yesNoChip(v?: string | null) {
  return /^\s*yes/i.test(String(v || "")) ? "ok" : "warn";
}
