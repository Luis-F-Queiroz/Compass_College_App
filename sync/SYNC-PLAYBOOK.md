# Compass sync — playbook

How information moves from **CoWork** (your authoritative workspace) onto the **Compass website**, safely
and repeatably. This is an *additive copy*: CoWork stays the source of truth, and nothing in CoWork is
ever moved, deleted, or rewritten by a sync.

## The flow

```
You tell CoWork something
        │  (CoWork keeps the original in its docs/memory — untouched)
        ▼
CoWork classifies it (Narrative Method) + applies the privacy gate
        │
        ▼
CoWork emits ONE sync package (JSON)  ──saved as the audit record──►  compass-app/sync/packages/<ts>.json
        │
        ▼
npm run sync -- plan   (preview, no writes)  ──►  you approve
        │
        ▼
npm run sync -- apply  ──►  deterministic merge engine
        │     • matches existing rows by (user_id, source, source_ref)  → never duplicates
        │     • fills gaps, updates its own prior values
        │     • a value that contradicts your edit → needs_review (never silently overwritten)
        │     • writes a before-image for every change → fully reversible
        ▼
Supabase Postgres  ──►  the website renders it;  /sync shows runs, conflicts, Proof-Type coverage
        │
        ▼
Wrong? npm run sync -- rollback <run_id>   (restores before-images; archives, never deletes)
```

## The two modes
- **initial** — first backfill. CoWork emits every relevant record. Run once.
- **update** — ongoing. Whenever you tell CoWork something new ("I won X", "change my MIT round to EA"),
  CoWork emits just that delta, reusing the record's stable `source_ref` so it updates in place.

## Using it
1. Paste `COWORK-SYNC-PROMPT.md` into CoWork (or just tell CoWork "sync this to the website").
2. CoWork builds the package and runs `npm run sync -- plan <file>`; review the summary.
3. Approve; CoWork runs `npm run sync -- apply <file>`. You get a run id.
4. Open the website's **Sync** page to see the run, resolve anything flagged, or roll back.

CLI (from `compass-app/`): `npm run sync -- <validate|plan|apply|rollback|list> [arg]`.
Engine tests: `npm test`.

## How conflicts & duplicates are handled
- **Duplicates:** impossible by construction — each record has one stable `source_ref`; a unique index on
  `(user_id, source, source_ref)` means re-running a package updates the same row. An unchanged re-run is a
  no-op. Rows you create by hand in the app have no `source_ref` and are invisible to sync (never touched).
- **Conflicts:** if a sync value contradicts a value you edited in the app after the last sync
  (`updated_at > synced_at`), or a value you authored manually, the engine does **not** overwrite it. It
  flags the row `needs_review` and records both values. Resolve on the **Sync** page: *Apply incoming* or
  *Mark reviewed* (keep yours).
- **Unverified info:** reflections and unsourced claims arrive as `needs_review`, never as confirmed fact.

## Provenance & recovery
- Every synced row carries `source`, `source_ref`, `synced_at`. The **Sync** page shows where each came from.
- Every run is logged with per-row before/after images (`sync_runs` / `sync_changes`). **Roll back** any
  run from the Sync page or the CLI; it replays the before-images and **archives** (never deletes) rows the
  run created. The saved package JSON is the immutable audit artifact.
- "Delete" on the website **archives** a synced row (`archived = true`) — it disappears from lists but is
  recoverable and won't be resurrected by the next sync. The CoWork original is never affected either way.

## What is — and isn't — automated
- Automated: classification, package generation, validation, merge, conflict detection, ledger, rollback.
- Manual (by design): approving an initial/large run before it writes; resolving `needs_review` items;
  confirming privacy-gated PII; pasting the prompt (or asking CoWork) to start a sync.

## Privacy
Secrets never enter a package, the database, the repo, or logs (the package has no secret field and the CLI
rejects secret-shaped keys; `sync/packages/` is gitignored). PII like document id / DOB / parent contact is
held for explicit confirmation. See `COWORK-SYNC-PROMPT.md` §5.

## Files
- `COWORK-SYNC-PROMPT.md` — the prompt you paste into CoWork.
- `src/lib/sync/{types,engine,operations}.ts` — canonical contract + pure merge engine + rollback/resolve.
- `scripts/sync.ts` — the CLI. `scripts/sync-engine.test.ts` — engine tests.
- `supabase/migrations/0005_sync_provenance_and_ledger.sql` — provenance columns + ledger.
- `src/app/(app)/sync/page.tsx` — the Sync dashboard.
- `sync/packages/` — saved audit packages (gitignored; hold personal data).
