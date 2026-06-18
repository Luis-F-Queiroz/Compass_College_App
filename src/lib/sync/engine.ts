// Pure, deterministic merge engine. No Supabase/fs imports — so it runs in unit tests without a DB
// and in the browser dashboard. Given a validated package + the existing rows, it returns a MergePlan
// the thin apply step executes (writes + ledger) in the caller.
//
// Merge rules (per field of an existing row):
//   M1 fill-null     : existing empty            -> write incoming
//   M2 no-op         : equal                     -> skip (idempotent re-run lands here)
//   M3 safe-update   : confirmed incoming, the existing value was sync-written & confirmed, AND the
//                      row is untouched since the last sync (updated_at <= synced_at) -> write
//   M4/M5 conflict   : anything else (human-authored value, human edit since sync, or needs_review
//                      incoming over a non-null) -> DO NOT write; flag row needs_review; record conflict
//
// Archive sets archived=true (never deletes). user_id, timestamps and provenance are stamped by the
// apply step, not here.

import {
  SYNC_SCHEMA_VERSION,
  ORDERED_ENTITIES,
  ENGINE_MANAGED_COLUMNS,
  type SyncPackage,
  type SyncItem,
  type SyncEntity,
  type MergePlan,
  type PlannedChange,
  type ConflictRecord,
  type RunSummary,
  type ProofType,
} from "./types.ts";

const ENTITY_SET = new Set<SyncEntity>(ORDERED_ENTITIES.concat(["profiles"] as SyncEntity[]));
const PROOF_TYPES = new Set<ProofType>(["Consistency", "Progression", "Ownership", "Impact"]);
const PROFILE_SENTINEL = "profile:singleton";

const SECRET_KEY_RE = /(password|passwd|secret|token|api[_-]?key|service[_-]?role|private[_-]?key|access[_-]?key|client[_-]?secret)/i;
const SECRET_VALUE_RE = /(eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|sb_secret_|service_role|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/;

type Row = Record<string, unknown>;

export interface EngineInput {
  pkg: SyncPackage;
  // existing rows by `${entity}::${source_ref}` -> row (full row incl. id, sync fields, updated_at)
  existingByProvenance: Record<string, Row>;
  // the singleton profiles row for this user, if any
  existingProfile: Row | null;
  // valid writable columns per entity (from information_schema minus engine-managed); fixture in tests
  validColumns: Record<string, string[]>;
}

function isEmpty(v: unknown): boolean {
  return (
    v === null ||
    v === undefined ||
    v === "" ||
    (Array.isArray(v) && v.length === 0)
  );
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  // tolerate number/string drift (e.g. "3.85" vs 3.85) only when string-equal after coercion
  return String(a) === String(b);
}

// A sync-owned row counts as "edited by a human since last sync" when its updated_at is meaningfully
// after its synced_at (the set_updated_at trigger bumps updated_at on every app edit). 1s epsilon
// absorbs same-transaction jitter between the engine write and the trigger.
function humanEditedSinceSync(row: Row): boolean {
  const synced = row.synced_at ? Date.parse(String(row.synced_at)) : NaN;
  const updated = row.updated_at ? Date.parse(String(row.updated_at)) : NaN;
  if (Number.isNaN(synced)) return row.source == null; // never synced => human iff manually created
  if (Number.isNaN(updated)) return false;
  return updated > synced + 1000;
}

export function validatePackage(pkg: unknown): string[] {
  const errs: string[] = [];
  const p = pkg as Record<string, unknown> | null;
  if (!p || typeof p !== "object") return ["package is not an object"];
  if (p.schema_version !== SYNC_SCHEMA_VERSION) errs.push(`schema_version must be ${SYNC_SCHEMA_VERSION}`);
  if (p.mode !== "initial" && p.mode !== "update") errs.push("mode must be 'initial' or 'update'");
  if (typeof p.generated_at !== "string" || Number.isNaN(Date.parse(p.generated_at as string)))
    errs.push("generated_at must be an ISO-8601 datetime");
  if (typeof p.source !== "string" || !p.source) errs.push("source must be a non-empty string");
  if ("user_id" in p) errs.push("package must NOT contain user_id (the engine injects it from the session)");
  if (!Array.isArray(p.items)) {
    errs.push("items must be an array");
    return errs;
  }
  const seen = new Set<string>();
  (p.items as unknown[]).forEach((raw, i) => {
    const it = raw as Record<string, unknown>;
    const w = `items[${i}]`;
    if (!ENTITY_SET.has(it?.entity as SyncEntity)) errs.push(`${w}.entity invalid: ${String(it?.entity)}`);
    if (it?.op !== "upsert" && it?.op !== "archive") errs.push(`${w}.op must be 'upsert' or 'archive'`);
    if (typeof it?.source_ref !== "string" || !it.source_ref) errs.push(`${w}.source_ref is required`);
    if (it?.confidence !== "confirmed" && it?.confidence !== "needs_review")
      errs.push(`${w}.confidence must be 'confirmed' or 'needs_review'`);
    if (it?.entity === "profiles" && it?.source_ref !== PROFILE_SENTINEL)
      errs.push(`${w} profiles source_ref must be '${PROFILE_SENTINEL}'`);
    const key = `${String(it?.entity)}::${String(it?.source_ref)}`;
    if (seen.has(key)) errs.push(`${w} duplicate (entity, source_ref): ${key}`);
    seen.add(key);
    const data = it?.data;
    if (data !== undefined && (typeof data !== "object" || data === null || Array.isArray(data))) {
      errs.push(`${w}.data must be an object`);
    } else if (data) {
      for (const [k, v] of Object.entries(data as Row)) {
        if (SECRET_KEY_RE.test(k)) errs.push(`${w}.data has secret-shaped key '${k}' (never sync secrets)`);
        if (typeof v === "string" && SECRET_VALUE_RE.test(v))
          errs.push(`${w}.data.${k} looks like a secret value (never sync secrets)`);
      }
    }
    if (it?.proof_types !== undefined) {
      if (!Array.isArray(it.proof_types) || (it.proof_types as unknown[]).some((x) => !PROOF_TYPES.has(x as ProofType)))
        errs.push(`${w}.proof_types must be a subset of [Consistency,Progression,Ownership,Impact]`);
    }
  });
  return errs;
}

function filterData(data: unknown, validCols: Set<string>): Row {
  const out: Row = {};
  if (!data || typeof data !== "object") return out;
  for (const [k, v] of Object.entries(data as Row)) {
    if (ENGINE_MANAGED_COLUMNS.has(k)) continue; // never accept engine-managed columns from data
    if (validCols.size > 0 && !validCols.has(k)) continue; // drop unknown columns silently
    out[k] = v;
  }
  return out;
}

function unionProofTypes(existing: unknown, incoming: ProofType[] | undefined): ProofType[] | null {
  if (!incoming || incoming.length === 0) return null;
  const cur = Array.isArray(existing) ? (existing as ProofType[]) : [];
  const merged = Array.from(new Set([...cur, ...incoming]));
  if (merged.length === cur.length && merged.every((x) => cur.includes(x))) return null; // unchanged
  return merged;
}

export function computeMergePlan(input: EngineInput): MergePlan {
  const { pkg, existingByProvenance, existingProfile, validColumns } = input;
  const summary: RunSummary = { inserted: 0, updated: 0, archived: 0, needs_review: 0, skipped: 0, conflicts: [] };
  const changes: PlannedChange[] = [];

  const errors = validatePackage(pkg);
  if (errors.length) {
    return { mode: (pkg as SyncPackage)?.mode, source: (pkg as SyncPackage)?.source, changes, summary, errors };
  }

  const items = [...pkg.items].sort(
    (a, b) => ORDERED_ENTITIES.indexOf(a.entity) - ORDERED_ENTITIES.indexOf(b.entity),
  );

  for (const it of items as SyncItem[]) {
    const existing =
      it.entity === "profiles" ? existingProfile : existingByProvenance[`${it.entity}::${it.source_ref}`] ?? null;
    const rowId = it.entity === "profiles" ? null : ((existing?.id as string) ?? null);
    const rowKey = it.entity === "profiles" ? ((existing?.user_id as string) ?? PROFILE_SENTINEL) : null;
    const rels = it.relationships ?? [];

    if (it.op === "archive") {
      if (!existing) {
        changes.push(mkChange(it, "skip", null, rowKey, null, null, false, [], rels));
        summary.skipped++;
        continue;
      }
      changes.push(mkChange(it, "archive", rowId, rowKey, { archived: true }, existing, false, [], rels));
      summary.archived++;
      continue;
    }

    const cols = new Set(validColumns[it.entity] ?? []);
    const cleanData = filterData(it.data, cols);

    // INSERT
    if (!existing) {
      const write: Row = { ...cleanData };
      if (it.proof_types && it.proof_types.length) write.proof_types = it.proof_types;
      if (it.theme != null && it.theme !== "") write.narrative_theme = it.theme;
      changes.push(mkChange(it, "insert", null, rowKey, write, null, it.confidence === "needs_review", [], rels));
      summary.inserted++;
      if (it.confidence === "needs_review") summary.needs_review++;
      continue;
    }

    // MERGE (existing row)
    const write: Row = {};
    const conflicts: ConflictRecord[] = [];
    const humanEdited = humanEditedSinceSync(existing);
    const syncOwnedClean =
      existing.source != null && existing.sync_status === "confirmed" && !humanEdited;

    for (const [f, vIn] of Object.entries(cleanData)) {
      const vCur = existing[f];
      if (isEmpty(vCur)) {
        write[f] = vIn; // M1
        continue;
      }
      if (deepEqual(vCur, vIn)) continue; // M2
      if (it.confidence === "confirmed" && syncOwnedClean) {
        write[f] = vIn; // M3
        continue;
      }
      conflicts.push({
        entity: it.entity,
        source_ref: it.source_ref,
        row_id: rowId,
        field: f,
        existing_value: vCur,
        incoming_value: vIn,
      }); // M4/M5
    }

    // proof_types: always additive union (never a conflict)
    const pt = unionProofTypes(existing.proof_types, it.proof_types);
    if (pt) write.proof_types = pt;
    // narrative_theme: fill-null or M3-guarded, else conflict
    if (it.theme != null && it.theme !== "") {
      const curTheme = existing.narrative_theme;
      if (isEmpty(curTheme)) write.narrative_theme = it.theme;
      else if (!deepEqual(curTheme, it.theme)) {
        if (it.confidence === "confirmed" && syncOwnedClean) write.narrative_theme = it.theme;
        else
          conflicts.push({
            entity: it.entity,
            source_ref: it.source_ref,
            row_id: rowId,
            field: "narrative_theme",
            existing_value: curTheme,
            incoming_value: it.theme,
          });
      }
    }

    const setNR = conflicts.length > 0;
    const hasWrite = Object.keys(write).length > 0;
    const op = hasWrite ? "update" : setNR ? "needs_review" : "skip";
    changes.push(mkChange(it, op, rowId, rowKey, hasWrite ? write : null, existing, setNR, conflicts, rels));

    if (op === "update") summary.updated++;
    else if (op === "needs_review") summary.needs_review++;
    else summary.skipped++;
    if (setNR) {
      summary.conflicts.push(...conflicts);
      if (op === "update") summary.needs_review++; // an updated row that also has conflicts is flagged
    }
  }

  return { mode: pkg.mode, source: pkg.source, changes, summary, errors: [] };
}

function mkChange(
  it: SyncItem,
  op: PlannedChange["op"],
  matchRowId: string | null,
  rowKey: string | null,
  write: Row | null,
  before: Row | null,
  setNR: boolean,
  conflicts: ConflictRecord[],
  relationships: PlannedChange["relationships"],
): PlannedChange {
  return {
    entity: it.entity,
    op,
    source_ref: it.source_ref,
    match_row_id: matchRowId,
    row_key: rowKey,
    write,
    before,
    set_needs_review: setNR,
    confidence: it.confidence,
    conflicts,
    relationships,
  };
}
