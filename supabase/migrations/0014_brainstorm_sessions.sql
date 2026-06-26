-- 0014: Personal-statement brainstorming — multiple named sessions.
-- Replaces the single app_config.ps_brainstorm textarea. Each session has a name, a method
-- (which brainstorming tool/technique), and content (text or serialized canvas JSON). Per-user RLS.

create table if not exists public.brainstorm_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  method text,
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.brainstorm_sessions enable row level security;
create policy "own brainstorm_sessions" on public.brainstorm_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_brainstorm_user on public.brainstorm_sessions(user_id);
