// Canonical CoWork -> website sync contract (schema_version 1) + ledger row types.
// The package is what CoWork emits; the pure engine (engine.ts) validates it and computes a plan;
// a thin apply step writes Postgres + the ledger. The package carries NO user_id — the engine
// injects it from the authenticated session (privacy/security feature). See migration 0005.

export const SYNC_SCHEMA_VERSION = 1 as const;

export type SyncEntity =
  | "colleges"
  | "essays"
  | "tasks"
  | "activities"
  | "ideas"
  | "profiles"
  | "scholarship_deadlines";

export type SyncStatus = "confirmed" | "needs_review";
export type SyncMode = "initial" | "update";
export type ItemOp = "upsert" | "archive";
export type ProofType = "Consistency" | "Progression" | "Ownership" | "Impact";

export type RelationshipType =
  | "essay_primary_college"
  | "essay_college"
  | "task_parent_college"
  | "task_parent_essay"
  | "scholarship_of_college";

export interface Relationship {
  type: RelationshipType;
  target_source_ref: string;
  // Optional advisory metadata (e.g. graphify-derived). Does not affect the FK write itself.
  confidence?: "EXTRACTED" | "INFERRED";
  confidence_score?: number;
}

// One package item = one logical CoWork record targeting one row, keyed by (source, source_ref).
export interface SyncItem {
  entity: SyncEntity;
  op: ItemOp; // 'upsert' = insert-or-merge; 'archive' = set archived=true (never deletes)
  source_ref: string; // stable provenance key; re-emitting the same ref targets the same row
  confidence: SyncStatus; // 'confirmed' may write; 'needs_review' only fills nulls + is held for review
  data: Record<string, unknown>; // partial snake_case columns; no secrets; engine-managed cols ignored
  proof_types?: ProofType[]; // Narrative-Method tags (union-merged, additive, never overwritten)
  theme?: string; // Core-Theme / hyperedge tag -> narrative_theme column
  relationships?: Relationship[]; // cross-entity FK/junction links (resolved at apply time)
  provenance?: { cowork_source?: string; note?: string };
  change_note?: string;
}

export interface ReviewFlag {
  source_ref: string;
  field?: string;
  reason: string;
}

export interface SyncPackage {
  schema_version: typeof SYNC_SCHEMA_VERSION;
  mode: SyncMode;
  generated_at: string; // ISO-8601
  source: string; // logical origin written to each row's `source` column, e.g. "cowork"
  items: SyncItem[];
  review_flags?: ReviewFlag[];
}

// Provenance/narrative columns added to every synced entity row by migration 0005.
export interface SyncFields {
  source: string | null;
  source_ref: string | null;
  sync_status: SyncStatus; // default 'confirmed'
  synced_at: string | null;
  archived: boolean; // default false
  proof_types: ProofType[]; // default {}
  narrative_theme: string | null;
}

// ---- Ledger (public.sync_runs / public.sync_changes) ----
export type RunStatus = "applying" | "applied" | "partial" | "rolled_back" | "failed";
export type ChangeOp = "insert" | "update" | "archive" | "needs_review" | "skip";

export interface ConflictRecord {
  entity: SyncEntity;
  source_ref: string;
  row_id: string | null;
  field: string;
  existing_value: unknown; // protected value (kept)
  incoming_value: unknown; // contradicting value (NOT written live)
}

export interface RunSummary {
  inserted: number;
  updated: number;
  archived: number;
  needs_review: number;
  skipped: number;
  conflicts: ConflictRecord[];
}

export interface SyncRun {
  id: string;
  user_id: string;
  mode: SyncMode;
  package_path: string | null;
  package_sha: string | null;
  generated_at: string | null;
  applied_at: string;
  status: RunStatus;
  summary: RunSummary;
  created_at: string;
}

export interface SyncChange {
  id: string;
  run_id: string;
  user_id: string;
  entity: SyncEntity;
  row_id: string | null; // null for profiles (keyed by user_id) -> see row_key
  row_key: string | null;
  op: ChangeOp;
  before: Record<string, unknown> | null; // null for inserts
  after: Record<string, unknown> | null;
  source_ref: string | null;
  created_at: string;
}

// ---- What the pure engine returns; the apply step executes it ----
export interface PlannedChange {
  entity: SyncEntity;
  op: ChangeOp;
  source_ref: string;
  match_row_id: string | null; // existing row id (null for insert / profiles)
  row_key: string | null; // profiles user_id
  write: Record<string, unknown> | null; // fields to write (insert: full; update: changed subset)
  before: Record<string, unknown> | null; // existing row snapshot (null for insert)
  set_needs_review: boolean; // flip row sync_status to needs_review
  confidence: SyncStatus; // item.confidence (drives sync_status on inserts/clean updates)
  conflicts: ConflictRecord[];
  relationships: Relationship[]; // passed through; resolved to FK ids by the apply step
}

export interface MergePlan {
  mode: SyncMode;
  source: string;
  changes: PlannedChange[];
  summary: RunSummary;
  errors: string[]; // non-empty => reject the package, apply nothing
}

export const ORDERED_ENTITIES: SyncEntity[] = [
  // dependency order so FK targets exist before referrers
  "colleges",
  "essays",
  "scholarship_deadlines",
  "tasks",
  "activities",
  "ideas",
  "profiles",
];

// Columns the engine manages itself and never accepts from item.data.
export const ENGINE_MANAGED_COLUMNS = new Set<string>([
  "id",
  "user_id",
  "created_at",
  "updated_at",
  "source",
  "source_ref",
  "sync_status",
  "synced_at",
  "archived",
  "proof_types",
  "narrative_theme",
]);
