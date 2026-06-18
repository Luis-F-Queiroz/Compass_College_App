-- 0005: sync provenance columns + sync ledger (runs/changes) for the CoWork->Postgres sync engine.
-- Additive and idempotent (IF NOT EXISTS throughout). Follows the conventions in 0001/0004:
--   * RLS per-user via auth.uid() = user_id, applied with a foreach-over-array loop
--   * any new function pins search_path = '' (0004 hardening convention)
--   * gen_random_uuid() PKs, on delete cascade FKs
-- This migration ONLY adds columns/tables/indexes/policies. It changes no existing data and
-- introduces no destructive operation. Website-side "delete" is modeled as archived = true.
--
-- NARRATIVE METHOD: proof_types text[] + narrative_theme text hold the Four Proof-Types
-- (Consistency/Progression/Ownership/Impact) and Core-Theme tag for each synced row, so the
-- /sync dashboard can render Proof-Type coverage (a Narrative-Blueprint audit surface).
--
-- M3 HUMAN-EDIT GUARD (engine-side, documented here): the merge engine compares updated_at vs
-- synced_at. A row whose updated_at > synced_at was edited in the app after the last sync, so a
-- contradicting incoming value becomes needs_review (conflict) rather than a silent overwrite.
--
-- PROFILE PROVENANCE: public.profiles has no id and is keyed by user_id (one row per user). The
-- merge engine always resolves a profiles item to that single row by the user_id PK; source_ref is
-- informational only (sentinel 'profile:singleton'). The partial UNIQUE index is created for
-- profiles too only so the engine can treat all entities uniformly; it can never collide.

-- ============================================================ 1. PROVENANCE + NARRATIVE COLUMNS
do $$
declare t text;
begin
  foreach t in array array['colleges','essays','tasks','activities','ideas','profiles','scholarship_deadlines']
  loop
    execute format('alter table public.%I add column if not exists source text;', t);
    execute format('alter table public.%I add column if not exists source_ref text;', t);
    execute format('alter table public.%I add column if not exists sync_status text not null default ''confirmed'';', t);
    execute format('alter table public.%I add column if not exists synced_at timestamptz;', t);
    execute format('alter table public.%I add column if not exists archived boolean not null default false;', t);
    execute format('alter table public.%I add column if not exists proof_types text[] not null default ''{}'';', t);
    execute format('alter table public.%I add column if not exists narrative_theme text;', t);
  end loop;
end $$;

-- sync_status CHECK constraints (added separately so they are idempotent and survive re-runs).
do $$
declare t text;
begin
  foreach t in array array['colleges','essays','tasks','activities','ideas','profiles','scholarship_deadlines']
  loop
    if not exists (
      select 1 from pg_constraint
      where conname = format('%s_sync_status_chk', t)
        and conrelid = format('public.%I', t)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I check (sync_status in (''confirmed'',''needs_review''));',
        t, format('%s_sync_status_chk', t)
      );
    end if;
  end loop;
end $$;

-- ============================================================ 2. PROVENANCE UNIQUE INDEXES
-- Guarantees idempotent upserts: a given (user_id, source, source_ref) maps to at most one row.
-- Partial (WHERE source_ref is not null) so manually-created, non-synced rows (source_ref NULL)
-- are unconstrained and any number of them coexist.
create unique index if not exists uq_colleges_provenance
  on public.colleges (user_id, source, source_ref) where source_ref is not null;
create unique index if not exists uq_essays_provenance
  on public.essays (user_id, source, source_ref) where source_ref is not null;
create unique index if not exists uq_tasks_provenance
  on public.tasks (user_id, source, source_ref) where source_ref is not null;
create unique index if not exists uq_activities_provenance
  on public.activities (user_id, source, source_ref) where source_ref is not null;
create unique index if not exists uq_ideas_provenance
  on public.ideas (user_id, source, source_ref) where source_ref is not null;
create unique index if not exists uq_scholarship_deadlines_provenance
  on public.scholarship_deadlines (user_id, source, source_ref) where source_ref is not null;
create unique index if not exists uq_profiles_provenance
  on public.profiles (user_id, source, source_ref) where source_ref is not null;

-- Partial indexes for the /sync dashboard to surface conflicts quickly.
do $$
declare t text;
begin
  foreach t in array array['colleges','essays','tasks','activities','ideas','profiles','scholarship_deadlines']
  loop
    execute format(
      'create index if not exists %I on public.%I (user_id) where sync_status = ''needs_review'';',
      format('idx_%s_needs_review', t), t
    );
  end loop;
end $$;

-- ============================================================ 3. SYNC LEDGER (runs + changes)
-- A "run" = one applied sync package. "changes" = per-row before/after images for rollback.
create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('initial','update')),
  package_path text,               -- compass-app/sync/packages/<timestamp>.json (audit record on disk)
  package_sha text,                -- sha256 of the package file; ties ledger row to the immutable artifact
  generated_at timestamptz,        -- package.generated_at (when CoWork emitted it)
  applied_at timestamptz not null default now(),
  status text not null default 'applied'
    check (status in ('applying','applied','partial','rolled_back','failed')),
  summary jsonb not null default '{}'::jsonb,  -- {inserted,updated,archived,needs_review,skipped,conflicts:[...]}
  created_at timestamptz not null default now()
);

create table if not exists public.sync_changes (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.sync_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity text not null,            -- one of the 7 synced tables
  row_id uuid,                     -- target row id; null for profiles (keyed by user_id) -> see row_key
  row_key text,                    -- stable identity for non-id rows (profiles user_id) and for audit
  op text not null check (op in ('insert','update','archive','needs_review','skip')),
  before jsonb,                    -- full row image BEFORE the change (null for inserts) -> powers rollback
  after  jsonb,                    -- full row image AFTER the change
  source_ref text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sync_runs_user on public.sync_runs(user_id);
create index if not exists idx_sync_changes_run on public.sync_changes(run_id);
create index if not exists idx_sync_changes_entity on public.sync_changes(entity, row_id);

-- ============================================================ 4. ROW-LEVEL SECURITY (ledger)
-- Mirrors the per-user pattern from 0001 exactly. Ledger rows carry user_id directly.
do $$
declare t text;
begin
  foreach t in array array['sync_runs','sync_changes']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists own_select on public.%I;', t);
    execute format('drop policy if exists own_insert on public.%I;', t);
    execute format('drop policy if exists own_update on public.%I;', t);
    execute format('drop policy if exists own_delete on public.%I;', t);
    execute format('create policy own_select on public.%I for select using (auth.uid() = user_id);', t);
    execute format('create policy own_insert on public.%I for insert with check (auth.uid() = user_id);', t);
    execute format('create policy own_update on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
    execute format('create policy own_delete on public.%I for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;

-- NOTE: existing RLS policies on the seven entity tables (from 0001, auth.uid() = user_id) are
-- table-scoped, not column-scoped, so they already cover the new provenance/narrative columns.

-- ============================================================ 5. AUDIT HELPER FUNCTION
-- search_path-hardened (0004 convention) convenience to summarise a run's changes.
create or replace function public.sync_describe_run(p_run_id uuid)
returns table (entity text, op text, n bigint)
language sql
stable
set search_path = ''
as $$
  select c.entity, c.op, count(*)::bigint
  from public.sync_changes c
  where c.run_id = p_run_id
  group by c.entity, c.op
  order by c.entity, c.op;
$$;
