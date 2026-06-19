-- 0010: Personal Statement support.
-- The Common App personal statement is ONE essay (same for all colleges), kept as drafts in the
-- essays table with parent_type='personal' (no college/program parent). Plus a brainstorm scratchpad
-- on app_config.

alter table public.app_config add column if not exists ps_brainstorm text;

-- allow 'personal' as an essay parent_type (personal-statement drafts have no institution parent)
alter table public.essays drop constraint if exists essays_parent_type_chk;
alter table public.essays add constraint essays_parent_type_chk
  check (parent_type is null or parent_type in ('college','summer_program','personal'));
