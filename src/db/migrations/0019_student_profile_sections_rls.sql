-- RLS for the 5 new student profile section tables (student_experience,
-- student_education, student_portfolio_items, student_certifications,
-- student_profile_links), mirroring student_profiles' own policy shape
-- exactly (see 0014_secure_public_tables_rls.sql): the owning student can
-- read/write their own rows; a company member can only SELECT once a real
-- application links that student to their company. No public/anon access.

create index if not exists student_experience_student_id_idx on public.student_experience (student_id);
create index if not exists student_education_student_id_idx on public.student_education (student_id);
create index if not exists student_portfolio_items_student_id_idx on public.student_portfolio_items (student_id);
create index if not exists student_certifications_student_id_idx on public.student_certifications (student_id);
create index if not exists student_profile_links_student_id_idx on public.student_profile_links (student_id);

alter table public.student_experience enable row level security;
alter table public.student_education enable row level security;
alter table public.student_portfolio_items enable row level security;
alter table public.student_certifications enable row level security;
alter table public.student_profile_links enable row level security;

revoke all on
  public.student_experience, public.student_education, public.student_portfolio_items,
  public.student_certifications, public.student_profile_links
from anon, authenticated;

grant select, insert, update, delete on public.student_experience to authenticated;
grant select, insert, update, delete on public.student_education to authenticated;
grant select, insert, update, delete on public.student_portfolio_items to authenticated;
grant select, insert, update, delete on public.student_certifications to authenticated;
grant select, insert, update, delete on public.student_profile_links to authenticated;

-- --- student_experience ------------------------------------------------------
drop policy if exists student_experience_select on public.student_experience;
create policy student_experience_select on public.student_experience for select to authenticated
using (
  student_id = public.app_user_id()
  or exists (
    select 1 from public.applications a
    join public.opportunities o on o.id = a.opportunity_id
    where a.student_id = student_experience.student_id and public.is_company_member(o.company_id)
  )
);
drop policy if exists student_experience_write on public.student_experience;
create policy student_experience_write on public.student_experience for all to authenticated
using (student_id = public.app_user_id())
with check (student_id = public.app_user_id());

-- --- student_education ------------------------------------------------------
drop policy if exists student_education_select on public.student_education;
create policy student_education_select on public.student_education for select to authenticated
using (
  student_id = public.app_user_id()
  or exists (
    select 1 from public.applications a
    join public.opportunities o on o.id = a.opportunity_id
    where a.student_id = student_education.student_id and public.is_company_member(o.company_id)
  )
);
drop policy if exists student_education_write on public.student_education;
create policy student_education_write on public.student_education for all to authenticated
using (student_id = public.app_user_id())
with check (student_id = public.app_user_id());

-- --- student_portfolio_items -------------------------------------------------
drop policy if exists student_portfolio_items_select on public.student_portfolio_items;
create policy student_portfolio_items_select on public.student_portfolio_items for select to authenticated
using (
  student_id = public.app_user_id()
  or exists (
    select 1 from public.applications a
    join public.opportunities o on o.id = a.opportunity_id
    where a.student_id = student_portfolio_items.student_id and public.is_company_member(o.company_id)
  )
);
drop policy if exists student_portfolio_items_write on public.student_portfolio_items;
create policy student_portfolio_items_write on public.student_portfolio_items for all to authenticated
using (student_id = public.app_user_id())
with check (student_id = public.app_user_id());

-- --- student_certifications --------------------------------------------------
drop policy if exists student_certifications_select on public.student_certifications;
create policy student_certifications_select on public.student_certifications for select to authenticated
using (
  student_id = public.app_user_id()
  or exists (
    select 1 from public.applications a
    join public.opportunities o on o.id = a.opportunity_id
    where a.student_id = student_certifications.student_id and public.is_company_member(o.company_id)
  )
);
drop policy if exists student_certifications_write on public.student_certifications;
create policy student_certifications_write on public.student_certifications for all to authenticated
using (student_id = public.app_user_id())
with check (student_id = public.app_user_id());

-- --- student_profile_links ----------------------------------------------------
drop policy if exists student_profile_links_select on public.student_profile_links;
create policy student_profile_links_select on public.student_profile_links for select to authenticated
using (
  student_id = public.app_user_id()
  or exists (
    select 1 from public.applications a
    join public.opportunities o on o.id = a.opportunity_id
    where a.student_id = student_profile_links.student_id and public.is_company_member(o.company_id)
  )
);
drop policy if exists student_profile_links_write on public.student_profile_links;
create policy student_profile_links_write on public.student_profile_links for all to authenticated
using (student_id = public.app_user_id())
with check (student_id = public.app_user_id());
