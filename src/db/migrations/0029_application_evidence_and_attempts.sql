-- Additive R4 entry/attempt foundation. No historical evidence or assignment
-- is invented: existing applications remain null until an explicit start.
alter table public.opportunities add column if not exists eligibility_requirements jsonb not null default '[]'::jsonb;
alter table public.opportunities alter column require_cv set default false;
alter table public.applications add column if not exists entry_evidence jsonb;
alter table public.applications add column if not exists assigned_challenge_version_id uuid references public.challenge_versions(id) on delete restrict;
create unique index if not exists submissions_application_uidx on public.submissions(application_id);
--> statement-breakpoint
-- Canonical actions use the trusted DB connection and enforce ownership.
-- Direct browser writes must not bypass eligibility, baseline evidence,
-- immutable assignment, or final-submission validation. SELECT RLS stays on.
revoke insert, update, delete on public.applications, public.submissions, public.submission_artifacts from authenticated, anon;
--> statement-breakpoint
create or replace function public.preserve_application_evidence_assignment()
returns trigger language plpgsql set search_path = public as $$
begin
  if TG_OP = 'UPDATE' and old.assigned_challenge_version_id is not null
     and new.assigned_challenge_version_id is distinct from old.assigned_challenge_version_id then
    raise exception 'A started Challenge assignment cannot be changed';
  end if;
  if TG_OP = 'UPDATE' and old.entry_evidence is not null and new.entry_evidence is distinct from old.entry_evidence then
    raise exception 'Submitted application evidence cannot be changed';
  end if;
  if new.assigned_challenge_version_id is not null and not exists (
    select 1 from public.challenge_versions v join public.challenges c on c.id=v.challenge_id
    where v.id=new.assigned_challenge_version_id and c.opportunity_id=new.opportunity_id
  ) then
    raise exception 'Challenge assignment must belong to this application opportunity';
  end if;
  return new;
end;
$$;
drop trigger if exists application_evidence_assignment_guard on public.applications;
create trigger application_evidence_assignment_guard before insert or update on public.applications
for each row execute function public.preserve_application_evidence_assignment();
--> statement-breakpoint
-- Keep direct Supabase reads consistent with signed-resource authorization.
-- Definer avoids policy recursion; identity still comes only from auth.uid().
create or replace function public.can_read_challenge_version(target_version uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.challenge_versions v
    join public.challenges c on c.id=v.challenge_id
    join public.opportunities o on o.id=c.opportunity_id
    where v.id=target_version and (
      public.is_company_member(o.company_id)
      or exists (select 1 from public.applications a where a.opportunity_id=o.id and a.student_id=public.app_user_id() and (
        a.assigned_challenge_version_id=v.id
        or exists (select 1 from public.submissions s where s.application_id=a.id and s.challenge_version_id=v.id)
      ))
      or (c.status='published' and o.status='published' and c.current_version_id=v.id
        and not exists (select 1 from public.applications a where a.opportunity_id=o.id and a.student_id=public.app_user_id() and (
          a.assigned_challenge_version_id is not null or exists (select 1 from public.submissions s where s.application_id=a.id)
        )))
    )
  );
$$;
revoke all on function public.can_read_challenge_version(uuid) from public, anon;
grant execute on function public.can_read_challenge_version(uuid) to authenticated;
drop policy if exists challenge_versions_select on public.challenge_versions;
create policy challenge_versions_select on public.challenge_versions for select to authenticated
using (public.can_read_challenge_version(id));
drop policy if exists challenge_resources_select on public.challenge_resources;
create policy challenge_resources_select on public.challenge_resources for select to authenticated
using (public.can_read_challenge_version(challenge_version_id) and exists (
  select 1 from public.challenge_versions v join public.challenges c on c.id=v.challenge_id join public.opportunities o on o.id=c.opportunity_id
  where v.id=challenge_resources.challenge_version_id and (public.is_company_member(o.company_id) or exists (
    select 1 from public.applications a where a.opportunity_id=o.id and a.student_id=public.app_user_id()
  ))
));
drop policy if exists challenge_resources_object_select on storage.objects;
create policy challenge_resources_object_select on storage.objects for select to authenticated
using (bucket_id='challenge-resources' and exists (
  select 1 from public.challenge_resources r where r.storage_path=storage.objects.name
  and public.can_read_challenge_version(r.challenge_version_id)
));
