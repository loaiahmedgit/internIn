-- Historical versions remain unclassified; no employer context or evidence
-- plan is retroactively invented. New versions opt into policy 1 in code.
alter table public.challenge_versions add column if not exists architect_policy_version integer not null default 0;
alter table public.challenge_versions add column if not exists role_reality jsonb;
alter table public.challenge_versions add column if not exists assessment_plan jsonb;
