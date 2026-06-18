// Client-operating sync helpers shared by the CLI (Node client) and the /sync dashboard (browser
// client) — both expose the same supabase-js `.from()` API, so one implementation serves both.
// These touch only Postgres (no filesystem, no CoWork files), and "undo" never deletes source data.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SyncEntity } from "./types.ts";

export interface RollbackResult {
  reverted: number;
  skipped: number;
  error?: string;
}

// Revert a run by replaying its sync_changes before-images in reverse. Inserts are archived (not
// deleted); updates/archives/needs_review restore the captured before-image. Records the rollback as
// its own auditable run and marks the original rolled_back.
export async function rollbackRun(
  client: SupabaseClient,
  runId: string,
  userId: string,
): Promise<RollbackResult> {
  const { data: run } = await client.from("sync_runs").select("*").eq("id", runId).maybeSingle();
  if (!run) return { reverted: 0, skipped: 0, error: "run not found" };
  if ((run as { status: string }).status === "rolled_back")
    return { reverted: 0, skipped: 0, error: "already rolled back" };

  const { data: changes } = await client
    .from("sync_changes")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: false });

  let reverted = 0;
  let skipped = 0;
  for (const raw of (changes ?? []) as Array<Record<string, unknown>>) {
    const entity = raw.entity as SyncEntity;
    const op = raw.op as string;
    const col = entity === "profiles" ? "user_id" : "id";
    const val = entity === "profiles" ? userId : (raw.row_id as string | null);
    if (!val) {
      skipped++;
      continue;
    }
    if (op === "insert") {
      await client.from(entity).update({ archived: true }).eq(col, val); // non-destructive inverse
      reverted++;
    } else if (op === "update" || op === "archive" || op === "needs_review") {
      const before = raw.before as Record<string, unknown> | null;
      if (!before) {
        skipped++;
        continue;
      }
      const restore = { ...before };
      delete restore.id;
      delete restore.created_at;
      await client.from(entity).update(restore).eq(col, val);
      reverted++;
    }
  }

  await client.from("sync_runs").update({ status: "rolled_back" }).eq("id", runId);
  await client
    .from("sync_runs")
    .insert({ user_id: userId, mode: "update", status: "applied", summary: { rollback_of: runId, reverted, skipped } });
  return { reverted, skipped };
}

// Resolve a needs_review conflict on one field: write the incoming value the engine shadowed.
// Leaves the row flagged until the user explicitly marks it reviewed (below).
export async function applyIncoming(
  client: SupabaseClient,
  entity: SyncEntity,
  rowId: string,
  userId: string,
  field: string,
  value: unknown,
): Promise<void> {
  const col = entity === "profiles" ? "user_id" : "id";
  const val = entity === "profiles" ? userId : rowId;
  await client.from(entity).update({ [field]: value }).eq(col, val);
}

// Clear the needs_review flag on a row (keep current values).
export async function markReviewed(
  client: SupabaseClient,
  entity: SyncEntity,
  rowId: string,
  userId: string,
): Promise<void> {
  const col = entity === "profiles" ? "user_id" : "id";
  const val = entity === "profiles" ? userId : rowId;
  await client.from(entity).update({ sync_status: "confirmed" }).eq(col, val);
}
