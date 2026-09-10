-- R1 — company endorsement / certificate honesty fix. Additive only.
-- No enum values removed, no columns dropped, no historical rows rewritten.

CREATE TYPE "public"."opportunity_responsibility_type" AS ENUM ('hiring_owner', 'challenge_owner', 'reviewer', 'certificate_approver');
--> statement-breakpoint

CREATE TABLE "opportunity_responsibility_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"company_member_id" uuid NOT NULL,
	"responsibility_type" "opportunity_responsibility_type" NOT NULL,
	"assigned_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opportunity_responsibility_assignments" ADD CONSTRAINT "opportunity_responsibility_assignments_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "opportunity_responsibility_assignments" ADD CONSTRAINT "opportunity_responsibility_assignments_company_member_id_company_members_id_fk" FOREIGN KEY ("company_member_id") REFERENCES "public"."company_members"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "opportunity_responsibility_assignments" ADD CONSTRAINT "opportunity_responsibility_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_responsibility_assignments_uidx" ON "opportunity_responsibility_assignments" USING btree ("opportunity_id","company_member_id","responsibility_type");
--> statement-breakpoint
CREATE INDEX "opportunity_responsibility_assignments_member_idx" ON "opportunity_responsibility_assignments" USING btree ("company_member_id");
--> statement-breakpoint
CREATE INDEX "opportunity_responsibility_assignments_opportunity_idx" ON "opportunity_responsibility_assignments" USING btree ("opportunity_id");
--> statement-breakpoint

ALTER TABLE "opportunity_responsibility_assignments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON "opportunity_responsibility_assignments" FROM public, anon, authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "opportunity_responsibility_assignments" TO authenticated;
--> statement-breakpoint

-- Company-boundary RLS only (same shape as program_supervisor_assignments,
-- 0024) — the certificate_approver/hiring_reviewer double-gate itself is
-- enforced in application code, this repo's established pattern throughout.
DROP POLICY IF EXISTS opportunity_responsibility_assignments_select ON "opportunity_responsibility_assignments";
--> statement-breakpoint
CREATE POLICY opportunity_responsibility_assignments_select ON "opportunity_responsibility_assignments" FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_responsibility_assignments.opportunity_id AND public.is_company_member(o.company_id)
  )
);
--> statement-breakpoint

DROP POLICY IF EXISTS opportunity_responsibility_assignments_write ON "opportunity_responsibility_assignments";
--> statement-breakpoint
CREATE POLICY opportunity_responsibility_assignments_write ON "opportunity_responsibility_assignments" FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_responsibility_assignments.opportunity_id AND public.is_company_member(o.company_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_responsibility_assignments.opportunity_id AND public.is_company_member(o.company_id)
  )
);
--> statement-breakpoint

-- challenge_credentials: durable identity/capability/withdrawal-actor
-- columns for the explicit human grant (R1 §9). company_endorsed itself
-- and its two existing timestamp/reason columns are untouched.
ALTER TABLE "challenge_credentials" ADD COLUMN IF NOT EXISTS "company_endorsed_by_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "challenge_credentials" ADD COLUMN IF NOT EXISTS "company_endorsed_capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "challenge_credentials" ADD COLUMN IF NOT EXISTS "endorsement_withdrawn_by_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "challenge_credentials" ADD CONSTRAINT "challenge_credentials_company_endorsed_by_user_id_users_id_fk" FOREIGN KEY ("company_endorsed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "challenge_credentials" ADD CONSTRAINT "challenge_credentials_endorsement_withdrawn_by_user_id_users_id_fk" FOREIGN KEY ("endorsement_withdrawn_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
