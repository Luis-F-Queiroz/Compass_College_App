-- Compass v2 — initial schema
-- One owner per row (user_id = auth.uid()); Row-Level Security isolates every table to its owner.
-- Field names mirror the v1 app's snake_case store so the model maps 1:1.

-- ---------- helper: auto-update updated_at ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ============================================================ COLLEGES
create table if not exists public.colleges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  application_round text,
  intended_major text,
  school_within text,
  application_status text,
  decision_status text,
  open_date date,
  deadline date,
  financial_aid_deadline date,
  testing_requirement text,
  english_proficiency text,
  interview text,
  recommendation_reqs text,
  portal_url text,
  website_url text,
  logo_url text,
  reasons_for_applying text,
  fit_assessment text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scholarship_deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  college_id uuid not null references public.colleges(id) on delete cascade,
  label text,
  date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================ ESSAYS (+ many-to-many to colleges)
create table if not exists public.essays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  primary_college_id uuid references public.colleges(id) on delete set null,
  prompt_text text,
  word_limit integer,
  deadline date,
  status text,
  google_doc_url text,
  version_note text,
  brainstorm_notes text,
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.essay_colleges (
  user_id uuid not null references auth.users(id) on delete cascade,
  essay_id uuid not null references public.essays(id) on delete cascade,
  college_id uuid not null references public.colleges(id) on delete cascade,
  primary key (essay_id, college_id)
);

-- ============================================================ TASKS (polymorphic parent: college | essay | none)
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  due_date date,
  priority text,
  status text,
  parent_type text check (parent_type in ('college','essay')),
  parent_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================ ACTIVITIES
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  organization text,
  role text,
  status text,
  start_date date,
  end_date date,
  hours_per_week numeric,
  weeks_per_year numeric,
  skills text[] not null default '{}',
  description text,
  responsibilities text,
  impact_achievements text,
  awards text,
  evidence_links text[] not null default '{}',
  narrative_relevance text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================ IDEAS
create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  category text,
  status text,
  tags text[] not null default '{}',
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================ PROFILE (single row per user)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  preferred_name text,
  date_of_birth date,
  document_id text,
  citizenship text,
  email text,
  phone text,
  address text,
  city text,
  state_region text,
  zip text,
  country text,
  high_school text,
  graduation_year integer,
  gpa text,
  class_rank text,
  sat_total integer,
  sat_ebrw integer,
  sat_math integer,
  act integer,
  toefl integer,
  collegeboard_url text,
  parent1_name text, parent1_relationship text, parent1_email text, parent1_occupation text,
  parent2_name text, parent2_relationship text, parent2_email text, parent2_occupation text,
  notes text,
  updated_at timestamptz not null default now()
);

-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array['colleges','scholarship_deadlines','essays','tasks','activities','ideas','profiles']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- ---------- indexes ----------
create index if not exists idx_colleges_user on public.colleges(user_id);
create index if not exists idx_essays_user on public.essays(user_id);
create index if not exists idx_tasks_user on public.tasks(user_id);
create index if not exists idx_tasks_parent on public.tasks(parent_type, parent_id);
create index if not exists idx_activities_user on public.activities(user_id);
create index if not exists idx_ideas_user on public.ideas(user_id);
create index if not exists idx_sched_college on public.scholarship_deadlines(college_id);
create index if not exists idx_essay_colleges_college on public.essay_colleges(college_id);

-- ============================================================ ROW-LEVEL SECURITY
do $$
declare t text;
begin
  foreach t in array array['colleges','scholarship_deadlines','essays','essay_colleges','tasks','activities','ideas','profiles']
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
