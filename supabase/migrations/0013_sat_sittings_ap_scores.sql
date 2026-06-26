-- 0013: College Board scores — SAT sittings + AP scores.
-- SAT is entered on the dedicated College Board page as MULTIPLE sittings (label/date + R&W + Math);
-- the SAT superscore = max(rw) + max(math) across sittings is computed in the UI. AP scores are
-- course + score (1-5). Both are user-entered (per-user RLS), not CoWork-synced.

create table if not exists public.sat_sittings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  test_date date,
  rw integer,
  math integer,
  created_at timestamptz not null default now()
);
alter table public.sat_sittings enable row level security;
create policy "own sat_sittings" on public.sat_sittings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_sat_sittings_user on public.sat_sittings(user_id);

create table if not exists public.ap_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course text,
  score integer,
  exam_year integer,
  created_at timestamptz not null default now()
);
alter table public.ap_scores enable row level security;
create policy "own ap_scores" on public.ap_scores for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_ap_scores_user on public.ap_scores(user_id);
