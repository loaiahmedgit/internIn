-- Security remediation for Supabase Security Advisor CRITICAL alert
-- "rls_disabled_in_public": every table in the public schema had Row-Level
-- Security disabled AND full SELECT/INSERT/UPDATE/DELETE/TRUNCATE grants to
-- both `anon` and `authenticated`. Confirmed by direct audit of production:
-- anyone holding the public anon key (shipped in the browser bundle) could
-- read or write every row of every table — companies, users, applications,
-- candidate evidence, internal recruiter notes — directly via the Supabase
-- Data API (PostgREST), completely bypassing the Next.js app.
--
-- This app's own server code never uses that path: every real query goes
-- through src/db/index.ts's Drizzle connection, which authenticates as the
-- `postgres` role (table owner, BYPASSRLS = true — confirmed by audit).
-- Enabling RLS below has ZERO effect on the app's own server-side queries;
-- it only closes the direct, unauthenticated Data API hole. Do NOT add
-- `FORCE ROW LEVEL SECURITY` anywhere in this file — that would apply RLS
-- to the table owner too and break the app's own connection.
--
-- Pattern: least privilege (REVOKE ALL, then GRANT back only the specific
-- verbs each table's policies actually use) + RLS policies that mirror the
-- app's own tenant model (auth.uid() -> users.auth_user_id -> users.id ->
-- company_members.company_id -> target row). No `USING (true)` anywhere.
--
-- Two SECURITY DEFINER helper functions only (fixed search_path, STABLE,
-- single SELECT each, parameterized by uuid, no dynamic SQL):
--   - app_user_id(): the caller's internal users.id
--   - is_company_member(uuid): whether the caller belongs to that company
-- Both live in `public` (PostgREST-exposed as RPCs by Supabase's design —
-- accepted, reviewed trade-off: each returns only a uuid/boolean, never
-- row content, so RPC exposure leaks no sensitive data). is_company_member
-- exists specifically so company_members' own SELECT policy never queries
-- company_members recursively (Section 7's stated risk) — the function
-- runs as its owner and is not subject to the caller's RLS on that table.

-- =============================================================================
-- 1. Helper functions
-- =============================================================================

create or replace function public.app_user_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.users where auth_user_id = auth.uid();
$$;

revoke all on function public.app_user_id() from public;
grant execute on function public.app_user_id() to authenticated;
-- Supabase applies its own default-privilege auto-grant to `anon` for
-- newly created functions in `public`, independent of the PUBLIC revoke
-- above — anon has no policy that calls this function, so revoke it
-- explicitly too (least privilege, not just "public").
revoke execute on function public.app_user_id() from anon;

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.company_members cm
    join public.users u on u.id = cm.user_id
    where cm.company_id = target_company_id
      and u.auth_user_id = auth.uid()
  );
$$;

revoke all on function public.is_company_member(uuid) from public;
grant execute on function public.is_company_member(uuid) to authenticated;
revoke execute on function public.is_company_member(uuid) from anon;

-- =============================================================================
-- 2. Enable RLS on every public table (no FORCE — see note above)
-- =============================================================================

alter table public.users enable row level security;
alter table public.student_profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.opportunities enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_versions enable row level security;
alter table public.applications enable row level security;
alter table public.submissions enable row level security;
alter table public.candidate_evidence enable row level security;
alter table public.internship_offers enable row level security;
alter table public.internship_programs enable row level security;
alter table public.internship_weeks enable row level security;
alter table public.internship_tasks enable row level security;
alter table public.supervisor_feedback enable row level security;
alter table public.verified_experience enable row level security;
alter table public.saved_opportunities enable row level security;
alter table public.event_log enable row level security;
alter table public.candidate_notes enable row level security;

-- =============================================================================
-- 3. Least-privilege grants: revoke the blanket defaults, then grant back
--    only the verbs each table's policies below actually support. A verb
--    with no matching policy is denied regardless of any grant, but we
--    still revoke it explicitly rather than leaning on RLS alone.
-- =============================================================================

revoke all on
  public.users, public.student_profiles, public.companies, public.company_members,
  public.opportunities, public.challenges, public.challenge_versions,
  public.applications, public.submissions, public.candidate_evidence,
  public.internship_offers, public.internship_programs, public.internship_weeks,
  public.internship_tasks, public.supervisor_feedback, public.verified_experience,
  public.saved_opportunities, public.event_log, public.candidate_notes
from anon, authenticated;

grant select on public.users to authenticated;
grant select, insert, update on public.student_profiles to authenticated;
grant select, update on public.companies to authenticated;
grant select on public.company_members to authenticated;
grant select, insert, update, delete on public.opportunities to authenticated;
grant select on public.opportunities to anon; -- published listings only (policy-scoped)
grant select, insert, update, delete on public.challenges to authenticated;
grant select, insert on public.challenge_versions to authenticated; -- immutable: no update/delete
grant select, insert, update on public.applications to authenticated;
grant select, insert, update on public.submissions to authenticated;
grant select on public.candidate_evidence to authenticated; -- server/AI-generated only
grant select, insert, update on public.internship_offers to authenticated;
grant select, insert, update on public.internship_programs to authenticated;
grant select, insert, update, delete on public.internship_weeks to authenticated;
grant select, insert, update, delete on public.internship_tasks to authenticated;
grant select, insert on public.supervisor_feedback to authenticated; -- feedback is not editable once given
grant select, update on public.verified_experience to authenticated; -- server creates the row
grant select, insert, delete on public.saved_opportunities to authenticated;
-- event_log: no grants at all — append-only audit trail, company-scoped
-- analytics reads go through the app's own privileged connection, never
-- through the Data API directly.
grant select, insert, update, delete on public.candidate_notes to authenticated;

-- =============================================================================
-- 4. Policies
-- =============================================================================

-- --- users ---------------------------------------------------------------
-- Self, a co-member of any shared company, or a company member viewing an
-- applicant who applied to one of their company's opportunities. No
-- write policy: the public.users row is created/updated by the server
-- during signup, never by a client insert/update.
drop policy if exists users_select on public.users;
create policy users_select on public.users for select to authenticated
using (
  auth_user_id = auth.uid()
  or exists (
    select 1 from public.company_members cm1
    join public.company_members cm2 on cm2.company_id = cm1.company_id
    where cm1.user_id = public.app_user_id() and cm2.user_id = users.id
  )
  or exists (
    select 1 from public.applications a
    join public.opportunities o on o.id = a.opportunity_id
    where a.student_id = users.id and public.is_company_member(o.company_id)
  )
);

-- --- student_profiles ------------------------------------------------------
drop policy if exists student_profiles_select on public.student_profiles;
create policy student_profiles_select on public.student_profiles for select to authenticated
using (
  user_id = public.app_user_id()
  or exists (
    select 1 from public.applications a
    join public.opportunities o on o.id = a.opportunity_id
    where a.student_id = student_profiles.user_id and public.is_company_member(o.company_id)
  )
);

drop policy if exists student_profiles_insert on public.student_profiles;
create policy student_profiles_insert on public.student_profiles for insert to authenticated
with check (user_id = public.app_user_id());

drop policy if exists student_profiles_update on public.student_profiles;
create policy student_profiles_update on public.student_profiles for update to authenticated
using (user_id = public.app_user_id())
with check (user_id = public.app_user_id());

-- --- companies -------------------------------------------------------------
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select to authenticated
using (public.is_company_member(id));

drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies for update to authenticated
using (public.is_company_member(id))
with check (public.is_company_member(id));
-- No insert/delete: company creation happens server-side at signup.

-- --- company_members ---------------------------------------------------
-- SELECT only, via the SECURITY DEFINER helper (never a self-referencing
-- subquery on company_members here — that's the recursion this table is
-- called out for). Membership writes (invite/remove/change role) stay
-- entirely server-side, gated by the app's own permission checks.
drop policy if exists company_members_select on public.company_members;
create policy company_members_select on public.company_members for select to authenticated
using (public.is_company_member(company_id));

-- --- opportunities -----------------------------------------------------
-- Classification C for the published subset (the product's own /opportunities
-- route is genuinely public); everything else stays company-scoped.
drop policy if exists opportunities_select_anon on public.opportunities;
create policy opportunities_select_anon on public.opportunities for select to anon
using (status = 'published');

drop policy if exists opportunities_select on public.opportunities;
create policy opportunities_select on public.opportunities for select to authenticated
using (status = 'published' or public.is_company_member(company_id));

drop policy if exists opportunities_insert on public.opportunities;
create policy opportunities_insert on public.opportunities for insert to authenticated
with check (public.is_company_member(company_id));

drop policy if exists opportunities_update on public.opportunities;
create policy opportunities_update on public.opportunities for update to authenticated
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

drop policy if exists opportunities_delete on public.opportunities;
create policy opportunities_delete on public.opportunities for delete to authenticated
using (public.is_company_member(company_id));

-- --- challenges --------------------------------------------------------
drop policy if exists challenges_select on public.challenges;
create policy challenges_select on public.challenges for select to authenticated
using (
  exists (select 1 from public.opportunities o where o.id = challenges.opportunity_id and public.is_company_member(o.company_id))
  or exists (select 1 from public.applications a where a.opportunity_id = challenges.opportunity_id and a.student_id = public.app_user_id())
);

drop policy if exists challenges_insert on public.challenges;
create policy challenges_insert on public.challenges for insert to authenticated
with check (exists (select 1 from public.opportunities o where o.id = challenges.opportunity_id and public.is_company_member(o.company_id)));

drop policy if exists challenges_update on public.challenges;
create policy challenges_update on public.challenges for update to authenticated
using (exists (select 1 from public.opportunities o where o.id = challenges.opportunity_id and public.is_company_member(o.company_id)))
with check (exists (select 1 from public.opportunities o where o.id = challenges.opportunity_id and public.is_company_member(o.company_id)));

drop policy if exists challenges_delete on public.challenges;
create policy challenges_delete on public.challenges for delete to authenticated
using (exists (select 1 from public.opportunities o where o.id = challenges.opportunity_id and public.is_company_member(o.company_id)));

-- --- challenge_versions --------------------------------------------------
-- INSERT only, deliberately: "every generation or edit produces a NEW
-- immutable version" (schema.ts) — no update/delete policy enforces that
-- invariant at the database level too, not just by convention.
drop policy if exists challenge_versions_select on public.challenge_versions;
create policy challenge_versions_select on public.challenge_versions for select to authenticated
using (
  exists (
    select 1 from public.challenges c join public.opportunities o on o.id = c.opportunity_id
    where c.id = challenge_versions.challenge_id
      and (public.is_company_member(o.company_id)
        or exists (select 1 from public.applications a where a.opportunity_id = o.id and a.student_id = public.app_user_id()))
  )
);

drop policy if exists challenge_versions_insert on public.challenge_versions;
create policy challenge_versions_insert on public.challenge_versions for insert to authenticated
with check (
  exists (
    select 1 from public.challenges c join public.opportunities o on o.id = c.opportunity_id
    where c.id = challenge_versions.challenge_id and public.is_company_member(o.company_id)
  )
);

-- --- applications --------------------------------------------------------
drop policy if exists applications_select on public.applications;
create policy applications_select on public.applications for select to authenticated
using (
  student_id = public.app_user_id()
  or exists (select 1 from public.opportunities o where o.id = applications.opportunity_id and public.is_company_member(o.company_id))
);

drop policy if exists applications_insert on public.applications;
create policy applications_insert on public.applications for insert to authenticated
with check (student_id = public.app_user_id());

drop policy if exists applications_update on public.applications;
create policy applications_update on public.applications for update to authenticated
using (
  student_id = public.app_user_id()
  or exists (select 1 from public.opportunities o where o.id = applications.opportunity_id and public.is_company_member(o.company_id))
)
with check (
  student_id = public.app_user_id()
  or exists (select 1 from public.opportunities o where o.id = applications.opportunity_id and public.is_company_member(o.company_id))
);

-- --- submissions -----------------------------------------------------------
drop policy if exists submissions_select on public.submissions;
create policy submissions_select on public.submissions for select to authenticated
using (
  exists (
    select 1 from public.applications a
    where a.id = submissions.application_id
      and (a.student_id = public.app_user_id()
        or exists (select 1 from public.opportunities o where o.id = a.opportunity_id and public.is_company_member(o.company_id)))
  )
);

drop policy if exists submissions_insert on public.submissions;
create policy submissions_insert on public.submissions for insert to authenticated
with check (exists (select 1 from public.applications a where a.id = submissions.application_id and a.student_id = public.app_user_id()));

drop policy if exists submissions_update on public.submissions;
create policy submissions_update on public.submissions for update to authenticated
using (
  exists (
    select 1 from public.applications a join public.opportunities o on o.id = a.opportunity_id
    where a.id = submissions.application_id and public.is_company_member(o.company_id)
  )
)
with check (
  exists (
    select 1 from public.applications a join public.opportunities o on o.id = a.opportunity_id
    where a.id = submissions.application_id and public.is_company_member(o.company_id)
  )
);

-- --- candidate_evidence ------------------------------------------------
-- Company-only, never the student — this is the company's internal AI
-- evaluation of the candidate, generated server-side. No write policy.
drop policy if exists candidate_evidence_select on public.candidate_evidence;
create policy candidate_evidence_select on public.candidate_evidence for select to authenticated
using (
  exists (
    select 1 from public.submissions s
    join public.applications a on a.id = s.application_id
    join public.opportunities o on o.id = a.opportunity_id
    where s.id = candidate_evidence.submission_id and public.is_company_member(o.company_id)
  )
);

-- --- internship_offers -----------------------------------------------------
drop policy if exists internship_offers_select on public.internship_offers;
create policy internship_offers_select on public.internship_offers for select to authenticated
using (
  exists (
    select 1 from public.applications a
    where a.id = internship_offers.application_id
      and (a.student_id = public.app_user_id()
        or exists (select 1 from public.opportunities o where o.id = a.opportunity_id and public.is_company_member(o.company_id)))
  )
);

drop policy if exists internship_offers_insert on public.internship_offers;
create policy internship_offers_insert on public.internship_offers for insert to authenticated
with check (
  exists (
    select 1 from public.applications a join public.opportunities o on o.id = a.opportunity_id
    where a.id = internship_offers.application_id and public.is_company_member(o.company_id)
  )
);

-- UPDATE covers both the company (managing the offer) and the student
-- (accepting/declining their own offer).
drop policy if exists internship_offers_update on public.internship_offers;
create policy internship_offers_update on public.internship_offers for update to authenticated
using (
  exists (
    select 1 from public.applications a
    where a.id = internship_offers.application_id
      and (a.student_id = public.app_user_id()
        or exists (select 1 from public.opportunities o where o.id = a.opportunity_id and public.is_company_member(o.company_id)))
  )
)
with check (
  exists (
    select 1 from public.applications a
    where a.id = internship_offers.application_id
      and (a.student_id = public.app_user_id()
        or exists (select 1 from public.opportunities o where o.id = a.opportunity_id and public.is_company_member(o.company_id)))
  )
);

-- --- internship_programs ----------------------------------------------------
drop policy if exists internship_programs_select on public.internship_programs;
create policy internship_programs_select on public.internship_programs for select to authenticated
using (
  exists (
    select 1 from public.internship_offers io
    join public.applications a on a.id = io.application_id
    where io.id = internship_programs.offer_id
      and (a.student_id = public.app_user_id()
        or exists (select 1 from public.opportunities o where o.id = a.opportunity_id and public.is_company_member(o.company_id)))
  )
);

drop policy if exists internship_programs_insert on public.internship_programs;
create policy internship_programs_insert on public.internship_programs for insert to authenticated
with check (
  exists (
    select 1 from public.internship_offers io
    join public.applications a on a.id = io.application_id
    join public.opportunities o on o.id = a.opportunity_id
    where io.id = internship_programs.offer_id and public.is_company_member(o.company_id)
  )
);

drop policy if exists internship_programs_update on public.internship_programs;
create policy internship_programs_update on public.internship_programs for update to authenticated
using (
  exists (
    select 1 from public.internship_offers io
    join public.applications a on a.id = io.application_id
    join public.opportunities o on o.id = a.opportunity_id
    where io.id = internship_programs.offer_id and public.is_company_member(o.company_id)
  )
)
with check (
  exists (
    select 1 from public.internship_offers io
    join public.applications a on a.id = io.application_id
    join public.opportunities o on o.id = a.opportunity_id
    where io.id = internship_programs.offer_id and public.is_company_member(o.company_id)
  )
);

-- --- internship_weeks --------------------------------------------------
drop policy if exists internship_weeks_select on public.internship_weeks;
create policy internship_weeks_select on public.internship_weeks for select to authenticated
using (
  exists (
    select 1 from public.internship_programs p
    join public.internship_offers io on io.id = p.offer_id
    join public.applications a on a.id = io.application_id
    where p.id = internship_weeks.program_id
      and (a.student_id = public.app_user_id()
        or exists (select 1 from public.opportunities o where o.id = a.opportunity_id and public.is_company_member(o.company_id)))
  )
);

drop policy if exists internship_weeks_write on public.internship_weeks;
create policy internship_weeks_write on public.internship_weeks for all to authenticated
using (
  exists (
    select 1 from public.internship_programs p
    join public.internship_offers io on io.id = p.offer_id
    join public.applications a on a.id = io.application_id
    join public.opportunities o on o.id = a.opportunity_id
    where p.id = internship_weeks.program_id and public.is_company_member(o.company_id)
  )
)
with check (
  exists (
    select 1 from public.internship_programs p
    join public.internship_offers io on io.id = p.offer_id
    join public.applications a on a.id = io.application_id
    join public.opportunities o on o.id = a.opportunity_id
    where p.id = internship_weeks.program_id and public.is_company_member(o.company_id)
  )
);

-- --- internship_tasks --------------------------------------------------
-- SELECT and UPDATE include the intern (their own task checklist);
-- INSERT/DELETE are company-only (planning the program stays company-side).
drop policy if exists internship_tasks_select on public.internship_tasks;
create policy internship_tasks_select on public.internship_tasks for select to authenticated
using (
  exists (
    select 1 from public.internship_weeks w
    join public.internship_programs p on p.id = w.program_id
    join public.internship_offers io on io.id = p.offer_id
    join public.applications a on a.id = io.application_id
    where w.id = internship_tasks.week_id
      and (a.student_id = public.app_user_id()
        or exists (select 1 from public.opportunities o where o.id = a.opportunity_id and public.is_company_member(o.company_id)))
  )
);

drop policy if exists internship_tasks_insert on public.internship_tasks;
create policy internship_tasks_insert on public.internship_tasks for insert to authenticated
with check (
  exists (
    select 1 from public.internship_weeks w
    join public.internship_programs p on p.id = w.program_id
    join public.internship_offers io on io.id = p.offer_id
    join public.applications a on a.id = io.application_id
    join public.opportunities o on o.id = a.opportunity_id
    where w.id = internship_tasks.week_id and public.is_company_member(o.company_id)
  )
);

drop policy if exists internship_tasks_update on public.internship_tasks;
create policy internship_tasks_update on public.internship_tasks for update to authenticated
using (
  exists (
    select 1 from public.internship_weeks w
    join public.internship_programs p on p.id = w.program_id
    join public.internship_offers io on io.id = p.offer_id
    join public.applications a on a.id = io.application_id
    where w.id = internship_tasks.week_id
      and (a.student_id = public.app_user_id()
        or exists (select 1 from public.opportunities o where o.id = a.opportunity_id and public.is_company_member(o.company_id)))
  )
)
with check (
  exists (
    select 1 from public.internship_weeks w
    join public.internship_programs p on p.id = w.program_id
    join public.internship_offers io on io.id = p.offer_id
    join public.applications a on a.id = io.application_id
    where w.id = internship_tasks.week_id
      and (a.student_id = public.app_user_id()
        or exists (select 1 from public.opportunities o where o.id = a.opportunity_id and public.is_company_member(o.company_id)))
  )
);

drop policy if exists internship_tasks_delete on public.internship_tasks;
create policy internship_tasks_delete on public.internship_tasks for delete to authenticated
using (
  exists (
    select 1 from public.internship_weeks w
    join public.internship_programs p on p.id = w.program_id
    join public.internship_offers io on io.id = p.offer_id
    join public.applications a on a.id = io.application_id
    join public.opportunities o on o.id = a.opportunity_id
    where w.id = internship_tasks.week_id and public.is_company_member(o.company_id)
  )
);

-- --- supervisor_feedback -------------------------------------------------
-- The intern can read feedback about themselves; only a company member of
-- the owning company can write it, and only as themselves (author_user_id).
-- No update/delete: feedback is not editable once given.
drop policy if exists supervisor_feedback_select on public.supervisor_feedback;
create policy supervisor_feedback_select on public.supervisor_feedback for select to authenticated
using (
  exists (
    select 1 from public.internship_programs p
    join public.internship_offers io on io.id = p.offer_id
    join public.applications a on a.id = io.application_id
    where p.id = supervisor_feedback.program_id
      and (a.student_id = public.app_user_id()
        or exists (select 1 from public.opportunities o where o.id = a.opportunity_id and public.is_company_member(o.company_id)))
  )
);

drop policy if exists supervisor_feedback_insert on public.supervisor_feedback;
create policy supervisor_feedback_insert on public.supervisor_feedback for insert to authenticated
with check (
  author_user_id = public.app_user_id()
  and exists (
    select 1 from public.internship_programs p
    join public.internship_offers io on io.id = p.offer_id
    join public.applications a on a.id = io.application_id
    join public.opportunities o on o.id = a.opportunity_id
    where p.id = supervisor_feedback.program_id and public.is_company_member(o.company_id)
  )
);

-- --- verified_experience -------------------------------------------------
drop policy if exists verified_experience_select on public.verified_experience;
create policy verified_experience_select on public.verified_experience for select to authenticated
using (
  exists (
    select 1 from public.internship_programs p
    join public.internship_offers io on io.id = p.offer_id
    join public.applications a on a.id = io.application_id
    where p.id = verified_experience.program_id
      and (a.student_id = public.app_user_id()
        or exists (select 1 from public.opportunities o where o.id = a.opportunity_id and public.is_company_member(o.company_id)))
  )
);

drop policy if exists verified_experience_update on public.verified_experience;
create policy verified_experience_update on public.verified_experience for update to authenticated
using (
  exists (
    select 1 from public.internship_programs p
    join public.internship_offers io on io.id = p.offer_id
    join public.applications a on a.id = io.application_id
    join public.opportunities o on o.id = a.opportunity_id
    where p.id = verified_experience.program_id and public.is_company_member(o.company_id)
  )
)
with check (
  exists (
    select 1 from public.internship_programs p
    join public.internship_offers io on io.id = p.offer_id
    join public.applications a on a.id = io.application_id
    join public.opportunities o on o.id = a.opportunity_id
    where p.id = verified_experience.program_id and public.is_company_member(o.company_id)
  )
);

-- --- saved_opportunities -------------------------------------------------
-- Purely private to the student who saved it — no company access at all.
drop policy if exists saved_opportunities_all on public.saved_opportunities;
create policy saved_opportunities_all on public.saved_opportunities for all to authenticated
using (student_id = public.app_user_id())
with check (student_id = public.app_user_id());

-- --- event_log -------------------------------------------------------------
-- Deliberately zero policies: RLS enabled, no grants, no policies. This is
-- an append-only, polymorphic (entity_type/entity_id, no FK) audit trail —
-- there is no safe generic way to scope it by tenant at this layer, and it
-- has no legitimate direct-client use case. Company-scoped analytics reads
-- go through the app's own privileged server connection.

-- --- candidate_notes ---------------------------------------------------
-- "Private, internal recruiter notes... never shown to the student"
-- (schema.ts) — company-only in every direction, no student access ever.
drop policy if exists candidate_notes_select on public.candidate_notes;
create policy candidate_notes_select on public.candidate_notes for select to authenticated
using (
  exists (
    select 1 from public.applications a join public.opportunities o on o.id = a.opportunity_id
    where a.id = candidate_notes.application_id and public.is_company_member(o.company_id)
  )
);

drop policy if exists candidate_notes_insert on public.candidate_notes;
create policy candidate_notes_insert on public.candidate_notes for insert to authenticated
with check (
  author_user_id = public.app_user_id()
  and exists (
    select 1 from public.applications a join public.opportunities o on o.id = a.opportunity_id
    where a.id = candidate_notes.application_id and public.is_company_member(o.company_id)
  )
);

drop policy if exists candidate_notes_update on public.candidate_notes;
create policy candidate_notes_update on public.candidate_notes for update to authenticated
using (
  exists (
    select 1 from public.applications a join public.opportunities o on o.id = a.opportunity_id
    where a.id = candidate_notes.application_id and public.is_company_member(o.company_id)
  )
)
with check (
  exists (
    select 1 from public.applications a join public.opportunities o on o.id = a.opportunity_id
    where a.id = candidate_notes.application_id and public.is_company_member(o.company_id)
  )
);

drop policy if exists candidate_notes_delete on public.candidate_notes;
create policy candidate_notes_delete on public.candidate_notes for delete to authenticated
using (
  exists (
    select 1 from public.applications a join public.opportunities o on o.id = a.opportunity_id
    where a.id = candidate_notes.application_id and public.is_company_member(o.company_id)
  )
);
