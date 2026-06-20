-- 0011: Applicant status portal link on colleges.
-- The school's APPLICANT status/check portal (where an applicant logs in to track their
-- application) — NOT the general student/enrollment portal. Shown as a per-row "Portal" link
-- on the read-only Colleges page; maintained via CoWork/code.

alter table public.colleges add column if not exists applicant_portal_url text;
