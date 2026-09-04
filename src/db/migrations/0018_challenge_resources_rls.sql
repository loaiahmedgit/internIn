-- RLS for the two new work-sample-engine tables (challenge_resources,
-- submission_artifacts), following 0014_secure_public_tables_rls.sql's
-- exact pattern: least privilege (REVOKE ALL, GRANT back only the verbs
-- actually used), then policies mirroring the app's tenant model. As with
-- 0014, this app's own server code connects as the `postgres` role
-- (BYPASSRLS) — these policies close the direct Supabase Data/Storage API
-- path only; real authorization is still enforced in application code
-- (getChallengeResourceDownloadUrlAction / getSubmissionArtifactDownloadUrlAction
-- re-check ownership/membership before minting a signed URL). Do NOT add
-- FORCE ROW LEVEL SECURITY here, for the same reason as 0014.

-- =============================================================================
-- 1. Table RLS
-- =============================================================================

alter table public.challenge_resources enable row level security;
alter table public.submission_artifacts enable row level security;

revoke all on public.challenge_resources from public, anon, authenticated;
revoke all on public.submission_artifacts from public, anon, authenticated;

-- select + insert + update (a company can retry/replace a resource that
-- failed to generate) — no delete, matching challenge_versions' own
-- immutable-by-convention posture.
grant select, insert, update on public.challenge_resources to authenticated;
-- select + insert only — what a student submitted never changes after the fact.
grant select, insert on public.submission_artifacts to authenticated;

-- --- challenge_resources ---------------------------------------------------
drop policy if exists challenge_resources_select on public.challenge_resources;
create policy challenge_resources_select on public.challenge_resources for select to authenticated
using (
  exists (
    select 1
    from public.challenge_versions cv
    join public.challenges c on c.id = cv.challenge_id
    join public.opportunities o on o.id = c.opportunity_id
    where cv.id = challenge_resources.challenge_version_id
      and (
        public.is_company_member(o.company_id)
        or exists (select 1 from public.applications a where a.opportunity_id = o.id and a.student_id = public.app_user_id())
      )
  )
);

drop policy if exists challenge_resources_insert on public.challenge_resources;
create policy challenge_resources_insert on public.challenge_resources for insert to authenticated
with check (
  exists (
    select 1
    from public.challenge_versions cv
    join public.challenges c on c.id = cv.challenge_id
    join public.opportunities o on o.id = c.opportunity_id
    where cv.id = challenge_resources.challenge_version_id and public.is_company_member(o.company_id)
  )
);

drop policy if exists challenge_resources_update on public.challenge_resources;
create policy challenge_resources_update on public.challenge_resources for update to authenticated
using (
  exists (
    select 1
    from public.challenge_versions cv
    join public.challenges c on c.id = cv.challenge_id
    join public.opportunities o on o.id = c.opportunity_id
    where cv.id = challenge_resources.challenge_version_id and public.is_company_member(o.company_id)
  )
)
with check (
  exists (
    select 1
    from public.challenge_versions cv
    join public.challenges c on c.id = cv.challenge_id
    join public.opportunities o on o.id = c.opportunity_id
    where cv.id = challenge_resources.challenge_version_id and public.is_company_member(o.company_id)
  )
);

-- --- submission_artifacts ---------------------------------------------------
drop policy if exists submission_artifacts_select on public.submission_artifacts;
create policy submission_artifacts_select on public.submission_artifacts for select to authenticated
using (
  exists (
    select 1
    from public.submissions s
    join public.applications a on a.id = s.application_id
    where s.id = submission_artifacts.submission_id
      and (
        a.student_id = public.app_user_id()
        or exists (select 1 from public.opportunities o where o.id = a.opportunity_id and public.is_company_member(o.company_id))
      )
  )
);

drop policy if exists submission_artifacts_insert on public.submission_artifacts;
create policy submission_artifacts_insert on public.submission_artifacts for insert to authenticated
with check (
  exists (
    select 1
    from public.submissions s
    join public.applications a on a.id = s.application_id
    where s.id = submission_artifacts.submission_id and a.student_id = public.app_user_id()
  )
);

-- =============================================================================
-- 2. Storage object RLS — private buckets, no persisted signed/public URLs
-- =============================================================================
-- Neither the existing `submission-artifacts` bucket nor the new
-- `challenge-resources` bucket has ever had a storage.objects policy
-- (confirmed by audit) — `submission-artifacts` was public until this
-- change (see scripts/setup-challenge-storage.mjs, which flips it to
-- private and creates `challenge-resources`). Real access control is the
-- server actions' own ownership/membership check before minting a
-- short-lived signed URL; these policies are defense-in-depth for the
-- direct Storage API path. Supabase enables RLS on storage.objects by
-- default — no ALTER TABLE ... ENABLE ROW LEVEL SECURITY needed here.

drop policy if exists challenge_resources_object_select on storage.objects;
create policy challenge_resources_object_select on storage.objects for select to authenticated
using (
  bucket_id = 'challenge-resources'
  and exists (
    select 1
    from public.challenge_resources cr
    join public.challenge_versions cv on cv.id = cr.challenge_version_id
    join public.challenges c on c.id = cv.challenge_id
    join public.opportunities o on o.id = c.opportunity_id
    where cr.storage_path = storage.objects.name
      and (
        public.is_company_member(o.company_id)
        or exists (select 1 from public.applications a where a.opportunity_id = o.id and a.student_id = public.app_user_id())
      )
  )
);

drop policy if exists submission_artifacts_object_select on storage.objects;
create policy submission_artifacts_object_select on storage.objects for select to authenticated
using (
  bucket_id = 'submission-artifacts'
  and exists (
    select 1
    from public.submission_artifacts sa
    join public.submissions s on s.id = sa.submission_id
    join public.applications a on a.id = s.application_id
    where sa.storage_path = storage.objects.name
      and (
        a.student_id = public.app_user_id()
        or exists (select 1 from public.opportunities o where o.id = a.opportunity_id and public.is_company_member(o.company_id))
      )
  )
);
