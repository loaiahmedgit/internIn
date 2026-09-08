-- Phase 6A — program_supervisor_assignments: scopes the company-wide
-- program_supervisor permission to specific InternshipProgram rows.
-- Hand-written (not drizzle-kit generate output) — this repo's migration
-- ledger predates drizzle-kit's own tracking (see apply-*-migration.mjs
-- scripts), and a straight `generate` here re-emitted the entire, already
-- applied challenge_credentials table alongside this one; discarded.

CREATE TABLE "program_supervisor_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"company_member_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"assigned_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "program_supervisor_assignments" ADD CONSTRAINT "program_supervisor_assignments_program_id_internship_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."internship_programs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "program_supervisor_assignments" ADD CONSTRAINT "program_supervisor_assignments_company_member_id_company_members_id_fk" FOREIGN KEY ("company_member_id") REFERENCES "public"."company_members"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "program_supervisor_assignments" ADD CONSTRAINT "program_supervisor_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "program_supervisor_assignments_program_member_uidx" ON "program_supervisor_assignments" USING btree ("program_id","company_member_id");
--> statement-breakpoint
CREATE INDEX "program_supervisor_assignments_member_idx" ON "program_supervisor_assignments" USING btree ("company_member_id");
--> statement-breakpoint
-- At most one primary supervisor per program (Phase 6A §2) — a partial
-- unique index, which Drizzle's table-level index builder can't express,
-- so it lives here rather than in schema.ts.
CREATE UNIQUE INDEX "program_supervisor_assignments_one_primary_uidx" ON "program_supervisor_assignments" USING btree ("program_id") WHERE "is_primary" = true;
--> statement-breakpoint

ALTER TABLE "program_supervisor_assignments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON "program_supervisor_assignments" FROM public, anon, authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "program_supervisor_assignments" TO authenticated;
--> statement-breakpoint

-- Same join-chain style already used for internship_programs/internship_weeks
-- (0014_secure_public_tables_rls.sql) — company boundary only; the actual
-- program_supervisor-permission + assignment business logic is enforced in
-- application code (this repo's established pattern throughout), not RLS.
DROP POLICY IF EXISTS program_supervisor_assignments_select ON "program_supervisor_assignments";
--> statement-breakpoint
CREATE POLICY program_supervisor_assignments_select ON "program_supervisor_assignments" FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.internship_programs p
    JOIN public.internship_offers io ON io.id = p.offer_id
    JOIN public.applications a ON a.id = io.application_id
    WHERE p.id = program_supervisor_assignments.program_id
      AND (a.student_id = public.app_user_id()
        OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = a.opportunity_id AND public.is_company_member(o.company_id)))
  )
);
--> statement-breakpoint

DROP POLICY IF EXISTS program_supervisor_assignments_write ON "program_supervisor_assignments";
--> statement-breakpoint
CREATE POLICY program_supervisor_assignments_write ON "program_supervisor_assignments" FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.internship_programs p
    JOIN public.internship_offers io ON io.id = p.offer_id
    JOIN public.applications a ON a.id = io.application_id
    JOIN public.opportunities o ON o.id = a.opportunity_id
    WHERE p.id = program_supervisor_assignments.program_id AND public.is_company_member(o.company_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.internship_programs p
    JOIN public.internship_offers io ON io.id = p.offer_id
    JOIN public.applications a ON a.id = io.application_id
    JOIN public.opportunities o ON o.id = a.opportunity_id
    WHERE p.id = program_supervisor_assignments.program_id AND public.is_company_member(o.company_id)
  )
);
