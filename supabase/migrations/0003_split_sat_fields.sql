-- 0003: split the combined SAT research field into separate range + median boxes.
-- Renames the existing free-text "percentiles" column to a clearer "range", and adds
-- a dedicated "median" column. The colleges table is empty at apply time, so the
-- rename loses no data. RLS is unchanged (policies are table-scoped, not column-scoped).
-- The rename is guarded so re-running the migrations directory against an already-migrated
-- DB is a no-op rather than an error (a plain RENAME COLUMN is not idempotent).

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'colleges' and column_name = 'sat_percentiles'
  ) then
    alter table colleges rename column sat_percentiles to sat_range;
  end if;
end $$;

alter table colleges add column if not exists sat_median text;
