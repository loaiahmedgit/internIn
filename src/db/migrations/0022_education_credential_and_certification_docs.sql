-- Student Profile data-entry audit fix (Deploy 1):
--   1. student_education.level: education_stage enum -> text. An education
--      ENTRY's credential level (Secondary/Diploma/Associate/Bachelor's/
--      Master's/Doctorate/Other) is a different taxonomy than the
--      profile-level educationStage, and needs values the enum doesn't
--      have. Lossless (text is a superset); confirmed 0 existing rows in
--      production at plan time, so no legacy-value remap needed here.
--   2. student_education.is_current: new column, mirrors
--      student_experience.is_current, drives "Currently studying here".
--   3. student_certifications.attachment_path / attachment_file_name: new
--      optional certificate-PDF reference. Private storage path only
--      (student-certifications bucket, created by
--      scripts/setup-student-certifications-storage.mjs) — never a
--      public/signed URL persisted here.
--   4. student_profiles.location normalization: confirmed via production
--      query that every existing non-null value is either "<Municipality>"
--      or "<Municipality>, Qatar", and every municipality present is
--      already one of the 8 canonical values — map each known legacy
--      variant explicitly to its canonical form before the new
--      z.enum(MUNICIPALITY_VALUES) validation ships. Lossless, verified
--      safe for 100% of current rows (no orphaned/unmappable values today).
--
--      NOTE ON A FIXED BUG: the first version of this statement used
--      trim(trailing ', Qatar' from location), which Postgres treats as a
--      CHARACTER SET to strip from the end, not a literal substring. Since
--      every character in "Doha" also appears in ", Qatar", it corrupted
--      "Doha, Qatar" into "Doh" in production (13 rows; hand-fixed via
--      UPDATE student_profiles SET location = 'Doha' WHERE location =
--      'Doh', verified 0 remaining 'Doh' rows and no other municipality
--      corrupted). Replaced below with an explicit CASE mapping — no
--      character-set trimming for suffix removal, ever. Idempotent: a
--      value already in canonical form (no ELSE branch match needed since
--      WHEN clauses only fire on exact known legacy strings) is returned
--      unchanged by the trailing "else location" branch.

alter table "student_education" alter column "level" type text using "level"::text;--> statement-breakpoint
alter table "student_education" add column "is_current" boolean not null default false;--> statement-breakpoint
alter table "student_certifications" add column "attachment_path" text;--> statement-breakpoint
alter table "student_certifications" add column "attachment_file_name" text;--> statement-breakpoint
update "student_profiles" set "location" = case "location"
  when 'Doha, Qatar' then 'Doha'
  when 'Al Rayyan, Qatar' then 'Al Rayyan'
  when 'Al Wakrah, Qatar' then 'Al Wakrah'
  when 'Al Khor and Al Thakira, Qatar' then 'Al Khor and Al Thakira'
  when 'Al Shamal, Qatar' then 'Al Shamal'
  when 'Umm Salal, Qatar' then 'Umm Salal'
  when 'Al Daayen, Qatar' then 'Al Daayen'
  when 'Al Shahaniya, Qatar' then 'Al Shahaniya'
  else "location"
end
where "location" like '%, Qatar';--> statement-breakpoint

-- storage.objects RLS for the new private student-certifications bucket,
-- same shape as 0018_challenge_resources_rls.sql's object-select policies:
-- defense-in-depth for the direct Storage API path (this app's own server
-- code connects as `postgres`, BYPASSRLS — real authorization is
-- getCertificationAttachmentDownloadUrlAction's own ownership check).
drop policy if exists student_certifications_object_select on storage.objects;--> statement-breakpoint
create policy student_certifications_object_select on storage.objects for select to authenticated
using (
  bucket_id = 'student-certifications'
  and exists (
    select 1 from public.student_certifications sc
    where sc.attachment_path = storage.objects.name
      and (
        sc.student_id = public.app_user_id()
        or exists (
          select 1 from public.applications a
          join public.opportunities o on o.id = a.opportunity_id
          where a.student_id = sc.student_id and public.is_company_member(o.company_id)
        )
      )
  )
);
