-- 0009: app_config — single-row-per-user store for app-level connections (the Google OAuth refresh
-- token for auto-creating Docs in the user's own Drive). RLS-scoped like every other table.
create table if not exists public.app_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_refresh_token text,
  google_connected_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
drop policy if exists own_select on public.app_config;
drop policy if exists own_insert on public.app_config;
drop policy if exists own_update on public.app_config;
drop policy if exists own_delete on public.app_config;
create policy own_select on public.app_config for select using (auth.uid() = user_id);
create policy own_insert on public.app_config for insert with check (auth.uid() = user_id);
create policy own_update on public.app_config for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_delete on public.app_config for delete using (auth.uid() = user_id);

drop trigger if exists set_updated_at on public.app_config;
create trigger set_updated_at before update on public.app_config
  for each row execute function public.set_updated_at();
