-- 0008: link essays to an institution (college OR summer program) + a reusable flag.
-- Essays already had primary_college_id (colleges only); add a polymorphic parent so supplements can
-- belong to a college or a summer_program, mirroring the tasks parent_type/parent_id pattern. Backfill
-- the existing college links. Additive + idempotent.

alter table public.essays add column if not exists parent_type text;
alter table public.essays add column if not exists parent_id uuid;
alter table public.essays add column if not exists is_reusable boolean not null default false;

-- constrain parent_type to the two institution kinds (idempotent)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'essays_parent_type_chk') then
    alter table public.essays add constraint essays_parent_type_chk
      check (parent_type is null or parent_type in ('college','summer_program'));
  end if;
end $$;

-- backfill: existing essays linked to a college via primary_college_id become college-parented
update public.essays
  set parent_type = 'college', parent_id = primary_college_id
  where parent_id is null and primary_college_id is not null;

create index if not exists idx_essays_parent on public.essays(parent_type, parent_id);
