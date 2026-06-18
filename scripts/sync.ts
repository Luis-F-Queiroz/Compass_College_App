// Compass sync CLI — the "CoWork writes directly" apply path.
// Run via:  npm run sync -- <command> [args]
//   validate <pkg.json>     parse + schema-validate a package (no DB)
//   plan     <pkg.json>     validate + read current rows + print the merge plan (no writes)
//   apply    <pkg.json>     plan + apply (writes entity rows + ledger), saves the package as audit record
//   rollback <run_id>       revert a run from its before-images (records the rollback as its own run)
//   list                    show recent sync runs
//
// Auth: signs in as the single user using SINGLE_USER_EMAIL/PASSWORD from .env.local and writes
// under RLS. No service-role key, no hardcoded secrets. The engine (engine.ts) is pure; this file
// is the only place that touches Supabase + the filesystem (to save the audit package).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { computeMergePlan } from "../src/lib/sync/engine.ts";
import { rollbackRun } from "../src/lib/sync/operations.ts";
import type { SyncPackage, MergePlan, PlannedChange, SyncEntity, RelationshipType } from "../src/lib/sync/types.ts";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES_DIR = join(APP_DIR, "sync", "packages");
const ENTITIES: SyncEntity[] = ["colleges", "essays", "tasks", "activities", "ideas", "profiles", "scholarship_deadlines"];
const ENGINE_MANAGED = new Set(["id", "user_id", "created_at", "updated_at", "source", "source_ref", "sync_status", "synced_at", "archived", "proof_types", "narrative_theme"]);

function loadEnv(): Record<string, string> {
  const path = join(APP_DIR, ".env.local");
  if (!existsSync(path)) die(`.env.local not found at ${path}`);
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function die(msg: string): never {
  console.error("ERROR: " + msg);
  process.exit(1);
}

async function getClient(): Promise<{ client: SupabaseClient; userId: string }> {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = env.SINGLE_USER_EMAIL;
  const password = env.SINGLE_USER_PASSWORD;
  if (!url || !anon || !email || !password) die("missing NEXT_PUBLIC_SUPABASE_URL/ANON_KEY or SINGLE_USER_EMAIL/PASSWORD in .env.local");
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) die("single-user sign-in failed: " + (error?.message ?? "no user"));
  return { client, userId: data.user.id };
}

function readPackage(file: string): { pkg: SyncPackage; bytes: string; sha: string } {
  const bytes = readFileSync(file, "utf8");
  let pkg: SyncPackage;
  try {
    pkg = JSON.parse(bytes);
  } catch (e) {
    die("package is not valid JSON: " + (e as Error).message);
  }
  const sha = createHash("sha256").update(bytes).digest("hex");
  return { pkg, bytes, sha };
}

async function getValidColumns(client: SupabaseClient): Promise<Record<string, string[]>> {
  // Derive the writable column allow-list from a live row's keys (minus engine-managed). If a table
  // is empty we pass an empty allow-list, in which case the engine keeps the (non-engine-managed)
  // keys it is given — safe because PostgREST itself rejects truly unknown columns on write.
  const out: Record<string, string[]> = {};
  for (const entity of ENTITIES) {
    const { data } = await client.from(entity).select("*").limit(1);
    if (data && data.length > 0) {
      out[entity] = Object.keys(data[0]).filter((k) => !ENGINE_MANAGED.has(k));
    } else {
      out[entity] = []; // empty allow-list => engine keeps only non-engine-managed keys it is given
    }
  }
  return out;
}

async function fetchExisting(client: SupabaseClient, pkg: SyncPackage, userId: string) {
  const byProvenance: Record<string, Record<string, unknown>> = {};
  for (const entity of ENTITIES) {
    if (entity === "profiles") continue;
    const refs = pkg.items.filter((i) => i.entity === entity).map((i) => i.source_ref);
    if (refs.length === 0) continue;
    const { data, error } = await client.from(entity).select("*").eq("source", pkg.source).in("source_ref", refs);
    if (error) die(`fetch ${entity}: ${error.message}`);
    for (const row of data ?? []) byProvenance[`${entity}::${(row as { source_ref: string }).source_ref}`] = row;
  }
  const { data: profile } = await client.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  return { byProvenance, profile: (profile as Record<string, unknown>) ?? null };
}

async function buildPlan(client: SupabaseClient, pkg: SyncPackage, userId: string): Promise<MergePlan> {
  const validColumns = await getValidColumns(client);
  const { byProvenance, profile } = await fetchExisting(client, pkg, userId);
  return computeMergePlan({ pkg, existingByProvenance: byProvenance, existingProfile: profile, validColumns });
}

function printPlan(plan: MergePlan) {
  if (plan.errors.length) {
    console.log("VALIDATION FAILED — package rejected, nothing will be written:");
    for (const e of plan.errors) console.log("  ✗ " + e);
    return;
  }
  const s = plan.summary;
  console.log(`Plan (${plan.mode}): ${s.inserted} insert · ${s.updated} update · ${s.archived} archive · ${s.skipped} skip · ${s.needs_review} needs-review`);
  for (const c of plan.changes) {
    const fields = c.write ? Object.keys(c.write).join(", ") : "—";
    console.log(`  ${c.op.padEnd(13)} ${c.entity}/${c.source_ref}${c.write ? "  [" + fields + "]" : ""}`);
  }
  if (s.conflicts.length) {
    console.log("\nConflicts held for review (existing value kept, incoming NOT written):");
    for (const cf of s.conflicts) console.log(`  ⚠ ${cf.entity}/${cf.source_ref}.${cf.field}: keep "${fmt(cf.existing_value)}" vs incoming "${fmt(cf.incoming_value)}"`);
  }
}

function fmt(v: unknown): string {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 40 ? s.slice(0, 37) + "…" : s;
}

const now = () => new Date().toISOString();

async function resolveId(client: SupabaseClient, idMap: Record<string, string>, entity: SyncEntity, source: string, ref: string): Promise<string | null> {
  const key = `${entity}::${ref}`;
  if (idMap[key]) return idMap[key];
  const { data } = await client.from(entity).select("id").eq("source", source).eq("source_ref", ref).maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

async function applyRelationships(client: SupabaseClient, plan: MergePlan, change: PlannedChange, idMap: Record<string, string>, userId: string) {
  const selfId = change.entity === "profiles" ? null : idMap[`${change.entity}::${change.source_ref}`];
  for (const rel of change.relationships) {
    const t = rel.type as RelationshipType;
    const targetEntity: SyncEntity = t === "task_parent_essay" ? "essays" : "colleges";
    const targetId = await resolveId(client, idMap, targetEntity, plan.source, rel.target_source_ref);
    if (!targetId || !selfId) continue; // unresolved -> skip (the item itself still applied)
    if (t === "essay_primary_college") await client.from("essays").update({ primary_college_id: targetId }).eq("id", selfId);
    else if (t === "task_parent_college") await client.from("tasks").update({ parent_type: "college", parent_id: targetId }).eq("id", selfId);
    else if (t === "task_parent_essay") await client.from("tasks").update({ parent_type: "essay", parent_id: targetId }).eq("id", selfId);
    else if (t === "scholarship_of_college") await client.from("scholarship_deadlines").update({ college_id: targetId }).eq("id", selfId);
    else if (t === "essay_college") await client.from("essay_colleges").upsert({ user_id: userId, essay_id: selfId, college_id: targetId }, { onConflict: "essay_id,college_id" });
  }
}

async function cmdApply(file: string) {
  const { client, userId } = await getClient();
  const { pkg, bytes, sha } = readPackage(file);
  const plan = await buildPlan(client, pkg, userId);
  if (plan.errors.length) {
    printPlan(plan);
    die("package rejected by validation; nothing written.");
  }

  mkdirSync(PACKAGES_DIR, { recursive: true });
  const stamp = now().replace(/[:.]/g, "-");
  const pkgPath = join(PACKAGES_DIR, `${stamp}.json`);
  writeFileSync(pkgPath, bytes); // immutable audit record

  const { data: run, error: runErr } = await client
    .from("sync_runs")
    .insert({ user_id: userId, mode: pkg.mode, status: "applying", generated_at: pkg.generated_at, package_path: pkgPath, package_sha: sha, summary: {} })
    .select()
    .single();
  if (runErr || !run) die("could not open sync run: " + runErr?.message);
  const runId = (run as { id: string }).id;

  const idMap: Record<string, string> = {};
  let ok = true;
  try {
    for (const c of plan.changes) {
      const stamp2 = now();
      if (c.op === "skip") continue;
      if (c.op === "insert") {
        const row = { ...(c.write ?? {}), user_id: userId, source: plan.source, source_ref: c.source_ref, sync_status: c.set_needs_review ? "needs_review" : c.confidence, synced_at: stamp2, archived: false };
        let inserted: Record<string, unknown> | null = null;
        if (c.entity === "profiles") {
          const { data } = await client.from("profiles").upsert({ ...row, user_id: userId }, { onConflict: "user_id" }).select().single();
          inserted = data as Record<string, unknown>;
        } else {
          const { data, error } = await client.from(c.entity).insert(row).select().single();
          if (error) throw error;
          inserted = data as Record<string, unknown>;
        }
        if (c.entity !== "profiles" && inserted?.id) idMap[`${c.entity}::${c.source_ref}`] = inserted.id as string;
        await client.from("sync_changes").insert({ run_id: runId, user_id: userId, entity: c.entity, row_id: c.entity === "profiles" ? null : (inserted?.id ?? null), row_key: c.entity === "profiles" ? userId : null, op: "insert", before: null, after: inserted, source_ref: c.source_ref });
      } else if (c.op === "update" || c.op === "needs_review" || c.op === "archive") {
        const patch: Record<string, unknown> = c.op === "archive" ? { archived: true, synced_at: stamp2 } : { ...(c.write ?? {}), synced_at: stamp2 };
        if (c.set_needs_review) patch.sync_status = "needs_review";
        let after: Record<string, unknown> | null = null;
        if (c.entity === "profiles") {
          const { data } = await client.from("profiles").update(patch).eq("user_id", userId).select().single();
          after = data as Record<string, unknown>;
        } else {
          const { data, error } = await client.from(c.entity).update(patch).eq("id", c.match_row_id as string).select().single();
          if (error) throw error;
          after = data as Record<string, unknown>;
          if (c.match_row_id) idMap[`${c.entity}::${c.source_ref}`] = c.match_row_id;
        }
        await client.from("sync_changes").insert({ run_id: runId, user_id: userId, entity: c.entity, row_id: c.entity === "profiles" ? null : c.match_row_id, row_key: c.entity === "profiles" ? userId : null, op: c.op, before: c.before, after, source_ref: c.source_ref });
      }
    }
    // relationship pass (best-effort; unresolved links are skipped, item data already applied)
    for (const c of plan.changes) if (c.relationships.length) await applyRelationships(client, plan, c, idMap, userId);
  } catch (e) {
    ok = false;
    console.error("apply error (run marked partial, reversible via rollback): " + (e as Error).message);
  }

  await client.from("sync_runs").update({ status: ok ? "applied" : "partial", summary: plan.summary, applied_at: now() }).eq("id", runId);
  console.log(`\n${ok ? "APPLIED" : "PARTIAL"} run ${runId}`);
  printPlan(plan);
  console.log(`\nAudit package: ${pkgPath}`);
  console.log(`Roll back with:  npm run sync -- rollback ${runId}`);
}

async function cmdRollback(runId: string) {
  const { client, userId } = await getClient();
  const res = await rollbackRun(client, runId, userId);
  if (res.error) die(res.error);
  console.log(`Rolled back run ${runId}: ${res.reverted} reverted, ${res.skipped} skipped.`);
}

async function cmdList() {
  const { client } = await getClient();
  const { data } = await client.from("sync_runs").select("id,mode,status,applied_at,summary").order("created_at", { ascending: false }).limit(15);
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    const s = r.summary as { inserted?: number; updated?: number; archived?: number; needs_review?: number } | null;
    console.log(`${String(r.applied_at).slice(0, 19)}  ${String(r.status).padEnd(11)} ${r.mode}  +${s?.inserted ?? 0}/~${s?.updated ?? 0}/▢${s?.archived ?? 0}/?${s?.needs_review ?? 0}  ${r.id}`);
  }
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "validate") {
    const { client, userId } = await getClient();
    const { pkg } = readPackage(arg);
    const plan = await buildPlan(client, pkg, userId);
    printPlan(plan);
    process.exit(plan.errors.length ? 1 : 0);
  } else if (cmd === "plan") {
    const { client, userId } = await getClient();
    const { pkg } = readPackage(arg);
    printPlan(await buildPlan(client, pkg, userId));
  } else if (cmd === "apply") {
    await cmdApply(arg);
  } else if (cmd === "rollback") {
    await cmdRollback(arg);
  } else if (cmd === "list") {
    await cmdList();
  } else {
    console.log("usage: npm run sync -- <validate|plan|apply|rollback|list> [arg]");
    process.exit(1);
  }
}

main().catch((e) => die(e.message));
