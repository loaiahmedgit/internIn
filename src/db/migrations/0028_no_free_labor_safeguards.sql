-- R3 — bounded No-Free-Labor safeguards.
-- Existing rows deliberately remain policy version 1 with null assessment
-- basis/attestation. That is an honest "pre-R3" marker: the migration never
-- fabricates a company confirmation. Existing published Challenges remain
-- live; any newly saved version is written as policy version 2 by application
-- code and must satisfy the new publication guard.

CREATE TYPE "assessment_basis" AS ENUM ('synthetic', 'fictional', 'historical_adapted', 'sandbox', 'anonymized_adapted');
--> statement-breakpoint

CREATE TYPE "production_work_risk" AS ENUM ('none', 'possible', 'high');
--> statement-breakpoint

ALTER TABLE "challenge_versions" ADD COLUMN "safeguard_policy_version" integer NOT NULL DEFAULT 1;
--> statement-breakpoint

ALTER TABLE "challenge_versions" ADD COLUMN "assessment_basis" "assessment_basis";
--> statement-breakpoint

ALTER TABLE "challenge_versions" ADD COLUMN "production_work_risk" "production_work_risk";
--> statement-breakpoint

ALTER TABLE "challenge_versions" ADD COLUMN "production_work_reason" text;
--> statement-breakpoint

ALTER TABLE "challenge_versions" ADD COLUMN "transformation_applied" boolean;
--> statement-breakpoint

ALTER TABLE "challenge_versions" ADD COLUMN "original_intent_summary" text;
--> statement-breakpoint

ALTER TABLE "challenge_versions" ADD COLUMN "non_production_confirmed_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint

ALTER TABLE "challenge_versions" ADD COLUMN "non_production_confirmed_at" timestamp with time zone;
--> statement-breakpoint

ALTER TABLE "challenge_versions" ADD COLUMN "duration_exception_justification" text;
