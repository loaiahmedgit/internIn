-- R2 — application modes (quick_apply / optional_challenge / challenge_required).
-- Read-only production audit (scripts/r2-production-audit.mjs, run before
-- writing this file) found 11 opportunities total, all published, all with
-- a usable (approved/published) challenge, zero applications on any
-- challenge-less opportunity — the conservative mapping below is safe.

CREATE TYPE "application_mode" AS ENUM ('quick_apply', 'optional_challenge', 'challenge_required');
--> statement-breakpoint

ALTER TABLE "opportunities" ADD COLUMN "application_mode" "application_mode" NOT NULL DEFAULT 'optional_challenge';
--> statement-breakpoint

-- Conservative backfill (R2 §3): only an opportunity with NO usable
-- (approved/published) challenge is set to quick_apply; every opportunity
-- with a usable challenge keeps the column default (optional_challenge),
-- which most closely preserves current live behavior. No row is ever
-- backfilled to challenge_required — that would retroactively create a new
-- fairness gate on historical applications, which R2 explicitly forbids.
UPDATE "opportunities" o
SET "application_mode" = 'quick_apply'
WHERE NOT EXISTS (
  SELECT 1 FROM "challenges" c
  WHERE c."opportunity_id" = o."id" AND c."status" IN ('approved', 'published')
);
