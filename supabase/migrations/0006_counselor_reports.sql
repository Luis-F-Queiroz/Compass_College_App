-- 0006: counselor_reports — short (<=200-word) doc-style updates for Luis's external college
-- counselor, who accesses the shared site. CoWork generates each report (from activities + the
-- weekly impact tracker) and inserts a row (auto-published: published_at defaults to now()). The
-- /counselor page renders the latest published report + a past-reports archive.
-- Follows 0001/0004 conventions: gen_random_uuid() PK, user_id + RLS (auth.uid() = user_id),
-- set_updated_at trigger (already search_path-hardened in 0004).

create table if not exists public.counselor_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  period_label text,                 -- e.g. "Jun 11–18, 2026" or "Since our last meeting"
  meeting_at timestamptz,            -- the counselor meeting this report was prepared for, if any
  summary text,                      -- main body: what he's been doing / since-last-meeting recap
  wins text,                         -- recent wins & impact (optional)
  whats_next text,                   -- what's next / upcoming (optional)
  through_line text,                 -- one-line narrative-spike note (optional)
  published_at timestamptz not null default now(),  -- auto-publish: set on insert
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_counselor_reports_user on public.counselor_reports(user_id);
create index if not exists idx_counselor_reports_published on public.counselor_reports(user_id, published_at desc);

drop trigger if exists set_updated_at on public.counselor_reports;
create trigger set_updated_at before update on public.counselor_reports
  for each row execute function public.set_updated_at();

alter table public.counselor_reports enable row level security;
drop policy if exists own_select on public.counselor_reports;
drop policy if exists own_insert on public.counselor_reports;
drop policy if exists own_update on public.counselor_reports;
drop policy if exists own_delete on public.counselor_reports;
create policy own_select on public.counselor_reports for select using (auth.uid() = user_id);
create policy own_insert on public.counselor_reports for insert with check (auth.uid() = user_id);
create policy own_update on public.counselor_reports for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_delete on public.counselor_reports for delete using (auth.uid() = user_id);
