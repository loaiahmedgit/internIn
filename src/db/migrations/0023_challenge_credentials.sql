-- Phase 4A: Verified Challenge Credential — core backend (data model,
-- eligibility/issuance services, RLS). See docs/12-verified-challenge-
-- credentials.md for the full architecture and this session's locked
-- product-owner decisions. Additive only — no existing column renamed,
-- retyped, or dropped; no existing row's meaning changes.

CREATE TYPE "public"."credential_policy" AS ENUM('off', 'internin_verified', 'company_endorsed');--> statement-breakpoint
CREATE TYPE "public"."credential_status" AS ENUM('pending_human_confirmation', 'issued', 'revoked');--> statement-breakpoint

-- companies: creation-time defaults only (§"New columns on companies" of
-- the architecture doc) — never read live at eligibility/issuance time, so
-- a safe direct default here has no effect on any existing challenge.
ALTER TABLE "companies" ADD COLUMN "default_credential_policy" "credential_policy" DEFAULT 'internin_verified' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "default_require_human_confirmation" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- challenges: the actual operative policy. Locked product decision this
-- session — existing challenges must NOT silently start issuing
-- credentials; only newly created challenges default to internin_verified.
-- Postgres applies a column's DEFAULT to every existing row when the
-- column is added NOT NULL, so adding it with DEFAULT 'off' is what
-- deterministically backfills every current row to 'off' — then the
-- DEFAULT is changed so only rows inserted AFTER this migration get
-- 'internin_verified'. This is two statements on purpose; collapsing them
-- into one ADD COLUMN ... DEFAULT 'internin_verified' would retroactively
-- enable credentials for every pre-existing challenge, which is exactly
-- what this migration must not do (§18/§19 of the locked decisions).
ALTER TABLE "challenges" ADD COLUMN "credential_policy" "credential_policy" DEFAULT 'off' NOT NULL;--> statement-breakpoint
ALTER TABLE "challenges" ALTER COLUMN "credential_policy" SET DEFAULT 'internin_verified';--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "require_human_confirmation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "show_company_logo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "required_integrity_mode" text;--> statement-breakpoint

CREATE TABLE "challenge_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"challenge_version_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"status" "credential_status" NOT NULL,
	"policy_snapshot" jsonb NOT NULL,
	"company_endorsed" boolean DEFAULT false NOT NULL,
	"company_endorsed_at" timestamp with time zone,
	"endorsement_withdrawn_at" timestamp with time zone,
	"endorsement_withdrawal_reason" text,
	"display_title" text NOT NULL,
	"company_display_name" text NOT NULL,
	"skills_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rubric_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"verification_code" text NOT NULL,
	"is_publicly_shared" boolean DEFAULT false NOT NULL,
	"publicly_shared_at" timestamp with time zone,
	"issued_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" uuid,
	"revocation_reason_internal" text,
	"revocation_reason_public" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_credentials_verification_code_unique" UNIQUE("verification_code")
);
--> statement-breakpoint
ALTER TABLE "challenge_credentials" ADD CONSTRAINT "challenge_credentials_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_credentials" ADD CONSTRAINT "challenge_credentials_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_credentials" ADD CONSTRAINT "challenge_credentials_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_credentials" ADD CONSTRAINT "challenge_credentials_challenge_version_id_challenge_versions_id_fk" FOREIGN KEY ("challenge_version_id") REFERENCES "public"."challenge_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_credentials" ADD CONSTRAINT "challenge_credentials_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_credentials" ADD CONSTRAINT "challenge_credentials_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "challenge_credentials_student_idx" ON "challenge_credentials" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "challenge_credentials_company_idx" ON "challenge_credentials" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "challenge_credentials_application_idx" ON "challenge_credentials" USING btree ("application_id");--> statement-breakpoint
-- One canonical ACTIVE credential per submission — a revoked row does not
-- block a fresh issuance (reissue produces a new row, §23 of the doc).
CREATE UNIQUE INDEX "challenge_credentials_submission_active_uidx" ON "challenge_credentials" USING btree ("submission_id") WHERE "revoked_at" IS NULL;

-- =============================================================================
-- RLS — same posture as 0018_challenge_resources_rls.sql: least privilege,
-- policies close the direct Supabase Data API path; this app's own server
-- code connects as the `postgres` role (BYPASSRLS) and enforces the real
-- authorization in application code (src/lib/credentials/*). No public/anon
-- grant here — a scoped server-side lookup by verification_code is what
-- Phase 4B's public page will use, not a broad table policy.
-- =============================================================================
--> statement-breakpoint
ALTER TABLE "challenge_credentials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON "challenge_credentials" FROM public, anon, authenticated;--> statement-breakpoint
-- select + insert + update (revoke/confirm/endorsement-withdraw are status
-- transitions on an existing row, never a delete) — no delete grant, ever.
GRANT SELECT, INSERT, UPDATE ON "challenge_credentials" TO authenticated;--> statement-breakpoint

DROP POLICY IF EXISTS challenge_credentials_select ON "challenge_credentials";--> statement-breakpoint
CREATE POLICY challenge_credentials_select ON "challenge_credentials" FOR SELECT TO authenticated
USING (
  student_id = public.app_user_id()
  OR public.is_company_member(company_id)
);--> statement-breakpoint

DROP POLICY IF EXISTS challenge_credentials_insert ON "challenge_credentials";--> statement-breakpoint
CREATE POLICY challenge_credentials_insert ON "challenge_credentials" FOR INSERT TO authenticated
WITH CHECK (public.is_company_member(company_id));--> statement-breakpoint

DROP POLICY IF EXISTS challenge_credentials_update ON "challenge_credentials";--> statement-breakpoint
CREATE POLICY challenge_credentials_update ON "challenge_credentials" FOR UPDATE TO authenticated
USING (public.is_company_member(company_id))
WITH CHECK (public.is_company_member(company_id));
