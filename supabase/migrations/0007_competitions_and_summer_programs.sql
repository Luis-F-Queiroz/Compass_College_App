-- 0007: competitions + summer_programs tables (new tracking tabs).
-- Columns mirror Luis's "Competitions & Programs Mapping" Excel, plus the agreed refinements.
-- Both follow 0001/0004 conventions: gen_random_uuid() PK, user_id + RLS (auth.uid() = user_id),
-- set_updated_at trigger, and the provenance pattern (source/source_ref + partial unique index +
-- archived) so CoWork can populate/upsert them without duplicates and the archive feature works.

-- ============================================================ COMPETITIONS
create table if not exists public.competitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  start_date date,
  registration_deadline date,
  phases text,                       -- freeform multi-date phase schedule
  topic text,                        -- Essay, Case Competition, Investments, ...
  difficulty text,
  prestige text,
  result text,                       -- outcome (e.g. "Qualified for phase 2")
  status text,                       -- tracking: Researching -> Registered -> ... -> Completed
  website_url text,
  source text,
  source_ref text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================ SUMMER PROGRAMS
create table if not exists public.summer_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  host text,                         -- hosting institution / org (UCLA, Wharton, Yale, ...)
  focus text,                        -- program focus / "intended program" area (Business, ...)
  term text,                         -- e.g. "Summer 2026"
  application_start date,
  deadline date,
  status text,                       -- Researching -> Applied -> Accepted/Rejected -> Enrolled -> Completed
  difficulty text,
  prestige text,
  cost text,
  financial_aid text,
  eligibility text,
  recommendation_reqs text,
  website_url text,
  portal_url text,
  logo_url text,
  special_notes text,
  source text,
  source_ref text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- indexes + provenance uniqueness (idempotent CoWork upserts)
create index if not exists idx_competitions_user on public.competitions(user_id);
create index if not exists idx_summer_programs_user on public.summer_programs(user_id);
create unique index if not exists uq_competitions_provenance
  on public.competitions (user_id, source, source_ref) where source_ref is not null;
create unique index if not exists uq_summer_programs_provenance
  on public.summer_programs (user_id, source, source_ref) where source_ref is not null;

-- updated_at triggers (set_updated_at is search_path-hardened in 0004)
do $$
declare t text;
begin
  foreach t in array array['competitions','summer_programs']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- RLS (mirrors 0001)
do $$
declare t text;
begin
  foreach t in array array['competitions','summer_programs']
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
