// Pure unit tests for the deterministic merge engine. No DB, no deps.
// Run: npm test  (node --experimental-strip-types --test scripts/sync-engine.test.ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMergePlan, validatePackage } from "../src/lib/sync/engine.ts";
import type { SyncPackage, SyncItem } from "../src/lib/sync/types.ts";

const VALID_COLUMNS: Record<string, string[]> = {
  activities: ["name", "organization", "role", "status", "description", "impact_achievements"],
  colleges: ["name", "application_status", "acceptance_rate", "notes"],
  profiles: ["full_name", "gpa", "sat_total"],
};

function pkg(items: SyncItem[], mode: "initial" | "update" = "update"): SyncPackage {
  return { schema_version: 1, mode, generated_at: "2026-06-17T12:00:00.000Z", source: "cowork", items };
}
function item(over: Partial<SyncItem> & Pick<SyncItem, "entity" | "source_ref">): SyncItem {
  return { op: "upsert", confidence: "confirmed", data: {}, ...over };
}
function run(p: SyncPackage, existingByProvenance = {}, existingProfile: Record<string, unknown> | null = null) {
  return computeMergePlan({ pkg: p, existingByProvenance, existingProfile, validColumns: VALID_COLUMNS });
}

test("INSERT: no existing row -> op insert with filtered data", () => {
  const p = pkg([item({ entity: "activities", source_ref: "activity:aam", data: { name: "AAM", role: "Founder", bogus: "x" } })]);
  const plan = run(p);
  assert.equal(plan.errors.length, 0);
  assert.equal(plan.summary.inserted, 1);
  const c = plan.changes[0];
  assert.equal(c.op, "insert");
  assert.deepEqual(c.write, { name: "AAM", role: "Founder" }); // unknown column 'bogus' dropped
});

test("IDEMPOTENT: re-applying identical data -> op skip, no write, no needs_review", () => {
  const existing = {
    "activities::activity:aam": {
      id: "11111111-1111-1111-1111-111111111111", user_id: "u", name: "AAM", role: "Founder",
      source: "cowork", source_ref: "activity:aam", sync_status: "confirmed",
      synced_at: "2026-06-17T10:00:00Z", updated_at: "2026-06-17T10:00:00Z",
    },
  };
  const p = pkg([item({ entity: "activities", source_ref: "activity:aam", data: { name: "AAM", role: "Founder" } })]);
  const plan = run(p, existing);
  assert.equal(plan.changes[0].op, "skip");
  assert.equal(plan.changes[0].write, null);
  assert.equal(plan.summary.needs_review, 0);
});

test("UPSERT BY PROVENANCE: fill a null field -> op update, only that field written", () => {
  const existing = {
    "activities::activity:aam": {
      id: "a1", user_id: "u", name: "AAM", role: null,
      source: "cowork", source_ref: "activity:aam", sync_status: "confirmed",
      synced_at: "2026-06-17T10:00:00Z", updated_at: "2026-06-17T10:00:00Z",
    },
  };
  const p = pkg([item({ entity: "activities", source_ref: "activity:aam", data: { name: "AAM", role: "Founder" } })]);
  const plan = run(p, existing);
  assert.equal(plan.changes[0].op, "update");
  assert.deepEqual(plan.changes[0].write, { role: "Founder" }); // name was equal (M2), role filled (M1)
});

test("CONFLICT: contradicting a human-authored (source null) value -> needs_review, NOT overwrite", () => {
  const existing = {
    "activities::activity:aam": {
      id: "a1", user_id: "u", name: "AAM", role: "President",
      source: null, source_ref: null, sync_status: "confirmed",
      synced_at: null, updated_at: "2026-06-17T10:00:00Z",
    },
  };
  const p = pkg([item({ entity: "activities", source_ref: "activity:aam", data: { role: "Member" } })]);
  const plan = run(p, existing);
  const c = plan.changes[0];
  assert.equal(c.write, null); // role NOT written
  assert.equal(c.set_needs_review, true);
  assert.equal(c.op, "needs_review");
  assert.equal(c.conflicts.length, 1);
  assert.equal(c.conflicts[0].existing_value, "President");
  assert.equal(c.conflicts[0].incoming_value, "Member");
});

test("M3 SAFE-UPDATE: sync-owned, untouched-since-sync, confirmed -> overwrites own prior value", () => {
  const existing = {
    "activities::activity:aam": {
      id: "a1", user_id: "u", role: "President",
      source: "cowork", source_ref: "activity:aam", sync_status: "confirmed",
      synced_at: "2026-06-17T10:00:00Z", updated_at: "2026-06-17T10:00:00Z",
    },
  };
  const p = pkg([item({ entity: "activities", source_ref: "activity:aam", data: { role: "Vice President" } })]);
  const plan = run(p, existing);
  assert.equal(plan.changes[0].op, "update");
  assert.deepEqual(plan.changes[0].write, { role: "Vice President" });
});

test("M3 GUARD: human-edited since sync (updated_at > synced_at) -> conflict, not overwrite", () => {
  const existing = {
    "activities::activity:aam": {
      id: "a1", user_id: "u", role: "President",
      source: "cowork", source_ref: "activity:aam", sync_status: "confirmed",
      synced_at: "2026-06-17T10:00:00Z", updated_at: "2026-06-17T12:00:00Z", // edited 2h after sync
    },
  };
  const p = pkg([item({ entity: "activities", source_ref: "activity:aam", data: { role: "Vice President" } })]);
  const plan = run(p, existing);
  assert.equal(plan.changes[0].write, null);
  assert.equal(plan.changes[0].set_needs_review, true);
  assert.equal(plan.changes[0].conflicts.length, 1);
});

test("ARCHIVE: existing row -> op archive sets archived=true (never deletes)", () => {
  const existing = {
    "colleges::college:mit": { id: "c1", user_id: "u", name: "MIT", source: "cowork", source_ref: "college:mit" },
  };
  const p = pkg([item({ entity: "colleges", source_ref: "college:mit", op: "archive" })]);
  const plan = run(p, existing);
  assert.equal(plan.changes[0].op, "archive");
  assert.deepEqual(plan.changes[0].write, { archived: true });
  assert.equal(plan.summary.archived, 1);
});

test("ARCHIVE missing target -> skip, no error", () => {
  const p = pkg([item({ entity: "colleges", source_ref: "college:ghost", op: "archive" })]);
  const plan = run(p);
  assert.equal(plan.changes[0].op, "skip");
  assert.equal(plan.summary.skipped, 1);
});

test("PROOF_TYPES: additive union, never overwrite", () => {
  const existing = {
    "activities::activity:aam": {
      id: "a1", user_id: "u", name: "AAM", proof_types: ["Impact"],
      source: "cowork", source_ref: "activity:aam", sync_status: "confirmed",
      synced_at: "2026-06-17T10:00:00Z", updated_at: "2026-06-17T10:00:00Z",
    },
  };
  const p = pkg([item({ entity: "activities", source_ref: "activity:aam", data: { name: "AAM" }, proof_types: ["Ownership", "Impact"] })]);
  const plan = run(p, existing);
  assert.deepEqual(plan.changes[0].write, { proof_types: ["Impact", "Ownership"] });
});

test("PROFILES: resolves to the singleton row by user_id; sentinel enforced", () => {
  const profile = {
    user_id: "u", full_name: "Luis", gpa: null,
    source: "cowork", source_ref: "profile:singleton", sync_status: "confirmed",
    synced_at: "2026-06-17T10:00:00Z", updated_at: "2026-06-17T10:00:00Z",
  };
  const p = pkg([item({ entity: "profiles", source_ref: "profile:singleton", data: { gpa: "3.9" } })]);
  const plan = run(p, {}, profile);
  assert.equal(plan.errors.length, 0);
  assert.equal(plan.changes[0].op, "update");
  assert.equal(plan.changes[0].row_key, "u");
  assert.equal(plan.changes[0].match_row_id, null);
  assert.deepEqual(plan.changes[0].write, { gpa: "3.9" });
});

test("VALIDATION: missing source_ref rejects the package (no changes)", () => {
  const bad = pkg([{ entity: "activities", op: "upsert", confidence: "confirmed", data: {}, source_ref: "" } as SyncItem]);
  const plan = run(bad);
  assert.ok(plan.errors.some((e) => /source_ref/.test(e)));
  assert.equal(plan.changes.length, 0);
});

test("VALIDATION: a user_id in the package is rejected (engine injects it from session)", () => {
  const bad = { ...pkg([]), user_id: "u" } as unknown as SyncPackage;
  const errs = validatePackage(bad);
  assert.ok(errs.some((e) => /user_id/.test(e)));
});

test("VALIDATION: secret-shaped key in data is rejected", () => {
  const bad = pkg([item({ entity: "profiles", source_ref: "profile:singleton", data: { api_key: "x" } })]);
  const plan = run(bad);
  assert.ok(plan.errors.some((e) => /secret-shaped/.test(e)));
  assert.equal(plan.changes.length, 0);
});

test("VALIDATION: profiles with a non-sentinel source_ref is rejected", () => {
  const bad = pkg([item({ entity: "profiles", source_ref: "profile:other", data: {} })]);
  const plan = run(bad);
  assert.ok(plan.errors.some((e) => /profile:singleton/.test(e)));
});

test("VALIDATION: duplicate (entity, source_ref) within one package is rejected", () => {
  const bad = pkg([
    item({ entity: "activities", source_ref: "activity:dup", data: { name: "A" } }),
    item({ entity: "activities", source_ref: "activity:dup", data: { name: "B" } }),
  ]);
  const plan = run(bad);
  assert.ok(plan.errors.some((e) => /duplicate/.test(e)));
});
