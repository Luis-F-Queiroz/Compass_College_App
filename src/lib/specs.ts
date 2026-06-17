export const ROUNDS = ["ED", "ED2", "EA", "REA", "RD", "Rolling"];
export const APP_STATUS = ["Researching", "Considering", "Planning to apply", "Not started", "In progress", "Ready for review", "Submitted", "Interview stage", "Deferred", "Waitlisted", "Accepted", "Rejected", "Withdrawn"];
export const ESSAY_STATUS = ["Not started", "Brainstorming", "Drafting", "Revising", "Feedback", "Final"];
export const TASK_STATUS = ["Open", "Doing", "Done"];
export const PRIORITY = ["High", "Medium", "Low"];
export const ACTIVITY_STATUS = ["Active", "Past", "Planned"];
export const IDEA_STATUS = ["New", "Keep", "Promoted", "Archived"];
export const TESTING = ["Required", "Optional", "Test-blind", "Not used"];
export const INTERVIEW = ["Required", "Optional", "Offered", "None"];
export const DECISION = ["Pending", "Accepted", "Rejected", "Deferred", "Waitlisted"];

export type FieldType = "text" | "textarea" | "number" | "date" | "url" | "select" | "tags";
export type Field = { k: string; label: string; type?: FieldType; options?: string[]; required?: boolean };
export type Column = { k: string; label: string; type?: "date" | "chip" };
export type Spec = {
  table: string;
  title: string;
  singular: string;
  logo?: boolean;
  columns: Column[];
  fields: Field[];
};

export const SPECS: Record<string, Spec> = {
  colleges: {
    table: "colleges", title: "Colleges", singular: "college", logo: true,
    columns: [
      { k: "name", label: "College" },
      { k: "application_round", label: "Round", type: "chip" },
      { k: "deadline", label: "Deadline", type: "date" },
      { k: "application_status", label: "Status", type: "chip" },
    ],
    fields: [
      { k: "name", label: "Name", required: true },
      { k: "application_round", label: "Application round", type: "select", options: ROUNDS },
      { k: "intended_major", label: "Intended major" },
      { k: "school_within", label: "School within university (e.g. Wharton)" },
      { k: "application_status", label: "Application status", type: "select", options: APP_STATUS },
      { k: "deadline", label: "Application deadline", type: "date" },
      { k: "financial_aid_deadline", label: "Financial-aid deadline", type: "date" },
      { k: "decision_status", label: "Decision", type: "select", options: DECISION },
      { k: "open_date", label: "Application opens", type: "date" },
      { k: "english_proficiency", label: "English proficiency (test/waiver)" },
      { k: "recommendation_reqs", label: "Recommendation requirements", type: "textarea" },
      { k: "fit_assessment", label: "Fit assessment", type: "textarea" },
      { k: "testing_requirement", label: "Testing", type: "select", options: TESTING },
      { k: "interview", label: "Interview", type: "select", options: INTERVIEW },
      { k: "website_url", label: "Website URL", type: "url" },
      { k: "portal_url", label: "Portal URL", type: "url" },
      { k: "logo_url", label: "Logo URL (optional)", type: "url" },
      { k: "reasons_for_applying", label: "Why this school", type: "textarea" },
      { k: "notes", label: "Notes", type: "textarea" },
    ],
  },
  essays: {
    table: "essays", title: "Essays", singular: "essay",
    columns: [
      { k: "title", label: "Title" },
      { k: "status", label: "Status", type: "chip" },
      { k: "word_limit", label: "Words" },
      { k: "deadline", label: "Deadline", type: "date" },
    ],
    fields: [
      { k: "title", label: "Title / prompt name", required: true },
      { k: "status", label: "Status", type: "select", options: ESSAY_STATUS },
      { k: "word_limit", label: "Word limit", type: "number" },
      { k: "deadline", label: "Deadline", type: "date" },
      { k: "google_doc_url", label: "Google Doc link", type: "url" },
      { k: "prompt_text", label: "Prompt text", type: "textarea" },
      { k: "brainstorm_notes", label: "Brainstorm notes", type: "textarea" },
      { k: "feedback", label: "Feedback received", type: "textarea" },
    ],
  },
  tasks: {
    table: "tasks", title: "Tasks", singular: "task",
    columns: [
      { k: "title", label: "Task" },
      { k: "due_date", label: "Due", type: "date" },
      { k: "priority", label: "Priority", type: "chip" },
      { k: "status", label: "Status", type: "chip" },
    ],
    fields: [
      { k: "title", label: "Task", required: true },
      { k: "due_date", label: "Due date", type: "date" },
      { k: "priority", label: "Priority", type: "select", options: PRIORITY },
      { k: "status", label: "Status", type: "select", options: TASK_STATUS },
      { k: "notes", label: "Notes", type: "textarea" },
    ],
  },
  activities: {
    table: "activities", title: "Activities", singular: "activity",
    columns: [
      { k: "name", label: "Activity" },
      { k: "role", label: "Role" },
      { k: "status", label: "Status", type: "chip" },
    ],
    fields: [
      { k: "name", label: "Activity name", required: true },
      { k: "organization", label: "Organization" },
      { k: "role", label: "Role / position" },
      { k: "status", label: "Status", type: "select", options: ACTIVITY_STATUS },
      { k: "hours_per_week", label: "Hours / week", type: "number" },
      { k: "weeks_per_year", label: "Weeks / year", type: "number" },
      { k: "skills", label: "Skills (comma-separated)", type: "tags" },
      { k: "impact_achievements", label: "Impact & achievements", type: "textarea" },
      { k: "description", label: "Description", type: "textarea" },
    ],
  },
  ideas: {
    table: "ideas", title: "Ideas", singular: "idea",
    columns: [
      { k: "text", label: "Idea" },
      { k: "status", label: "Status", type: "chip" },
    ],
    fields: [
      { k: "text", label: "Idea", type: "textarea", required: true },
      { k: "category", label: "Category" },
      { k: "status", label: "Status", type: "select", options: IDEA_STATUS },
      { k: "tags", label: "Tags (comma-separated)", type: "tags" },
    ],
  },
};
