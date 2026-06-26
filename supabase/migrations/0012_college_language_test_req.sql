-- 0012: Language-test requirement on colleges.
-- Per-school language-test requirement (TOEFL / Duolingo / IELTS / etc.) shown in the
-- Admissions section of the read-only college "Learn More" page; maintained via CoWork.

alter table public.colleges add column if not exists language_test_req text;
