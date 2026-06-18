-- 0004: harden the set_updated_at() trigger helper by pinning its search_path.
-- Backfills a migration that was applied to the live DB (version 20260617211001,
-- "harden_set_updated_at_search_path") but had no committed .sql file. Setting
-- search_path = '' stops search_path injection — the function can no longer be
-- tricked into resolving objects from an attacker-controlled schema — and clears
-- Supabase's "function_search_path_mutable" advisor on the helper from 0001_init.sql.
--
-- Ordering note: this was actually applied right after 0001_init (before 0002/0003),
-- but it only touches set_updated_at(), which 0002/0003 never reference. Re-running the
-- directory in file order (0001 -> 0002 -> 0003 -> 0004) reaches the same end state, so
-- it is filed as 0004 to avoid renumbering the existing committed migrations.
-- CREATE OR REPLACE makes this safe to re-run.

create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin new.updated_at = now(); return new; end; $$;
