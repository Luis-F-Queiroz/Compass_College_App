// Entity types — mirror the Postgres schema / v1 store field names.

export interface ScholarshipDeadline {
  id: string;
  college_id: string;
  label: string | null;
  date: string | null;
  notes: string | null;
}

export interface College {
  id: string;
  user_id: string;
  name: string;
  application_round: string | null;
  intended_major: string | null;
  school_within: string | null;
  application_status: string | null;
  decision_status: string | null;
  open_date: string | null;
  deadline: string | null;
  financial_aid_deadline: string | null;
  testing_requirement: string | null;
  english_proficiency: string | null;
  interview: string | null;
  recommendation_reqs: string | null;
  portal_url: string | null;
  website_url: string | null;
  logo_url: string | null;
  reasons_for_applying: string | null;
  fit_assessment: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Essay {
  id: string;
  user_id: string;
  title: string;
  primary_college_id: string | null;
  college_ids: string[];
  prompt_text: string | null;
  word_limit: number | null;
  deadline: string | null;
  status: string | null;
  google_doc_url: string | null;
  version_note: string | null;
  brainstorm_notes: string | null;
  feedback: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  due_date: string | null;
  priority: string | null;
  status: string | null;
  parent_type: "college" | "essay" | null;
  parent_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  user_id: string;
  name: string;
  organization: string | null;
  role: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  hours_per_week: number | null;
  weeks_per_year: number | null;
  skills: string[];
  description: string | null;
  responsibilities: string | null;
  impact_achievements: string | null;
  awards: string | null;
  evidence_links: string[];
  narrative_relevance: string | null;
  created_at: string;
  updated_at: string;
}

export interface Idea {
  id: string;
  user_id: string;
  text: string;
  category: string | null;
  status: string | null;
  tags: string[];
  captured_at: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  user_id: string;
  full_name: string | null;
  preferred_name: string | null;
  date_of_birth: string | null;
  document_id: string | null;
  citizenship: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state_region: string | null;
  zip: string | null;
  country: string | null;
  high_school: string | null;
  graduation_year: number | null;
  gpa: string | null;
  class_rank: string | null;
  sat_total: number | null;
  sat_ebrw: number | null;
  sat_math: number | null;
  act: number | null;
  toefl: number | null;
  collegeboard_url: string | null;
  parent1_name: string | null;
  parent1_relationship: string | null;
  parent1_email: string | null;
  parent1_occupation: string | null;
  parent2_name: string | null;
  parent2_relationship: string | null;
  parent2_email: string | null;
  parent2_occupation: string | null;
  notes: string | null;
  updated_at: string;
}
