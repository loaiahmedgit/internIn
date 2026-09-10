# internIn — Agent Handoff

**This is a CURRENT-STATE OPERATING DOCUMENT, not a diary.** It describes what internIn is *now*, what is live, what is frozen, and what to do next.

## If you are a new coding agent taking over this repository

1. Read this file completely before editing.
2. Read the referenced architecture docs (§"Canonical architecture docs" below).
3. Run `git status` and `git log --oneline -10`. Inspect the real schema/code — do not trust stale prose over what you can read now.
4. The **current** master direction is HONESTY + EVIDENCE (see below). Older roadmap docs (`docs/00`–`docs/11`) are still the source of truth for *product scope/mechanics*, but where an older doc conflicts with the honesty direction or with `docs/13`, the honesty direction wins.
5. Preserve working functionality. Phases 4A–6B, R1, R2, and R3 are done and verified — do not undo them because an older doc reads differently.
6. Continue from the **NEXT TASK** section at the bottom unless the owner gives newer instructions. Current owner instructions always override this file.
7. Report uncertainty instead of fabricating implementation state.

---

## Current master product direction: HONESTY

internIn helps companies evaluate early-career candidates using **profile evidence + demonstrated evidence + human verification** — not only prior experience.

**The semantic ladder (never collapse these into a generic "Verified"):**

- **CLAIMED** — a candidate/company stated something.
- **OBSERVED** — internIn directly observed an event/artifact (e.g. a raw submission).
- **VALIDATED** — a defined deterministic check confirmed a specific factual condition.
- **DEMONSTRATED** — accumulated evidence supports an ability *in the tested context* (internIn's AI-evaluated rubric criteria at `strong`/`solid`).
- **HUMAN REVIEWED** — an authorized person inspected the evidence. Inspection alone is **not** endorsement.
- **COMPANY ENDORSED** — an explicitly authorized company person intentionally recognized *specific* demonstrated capabilities. Never inferred, never automatic.
- **NOT ASSESSED / NOT DIGITALLY VERIFIED / UNKNOWN** — say this plainly rather than implying more.

**Ability ≠ overall suitability.** A Challenge gives evidence about specific role-relevant work. It does **not** establish total job suitability, culture fit, motivation, long-term reliability, future performance, real-world teamwork, or physical execution. Do not build a global "suitability score."

---

## Current product core

Company creates internship → applicant applies → realistic Challenge where applicable → applicant produces an actual artifact/work → internIn validates observable/objective evidence where possible → AI organizes evidence honestly → human company reviewer inspects quickly → **human** hiring decision → optional explicit human company endorsement.

**Near-term focus:** `CHALLENGE → EVIDENCE → FAST HUMAN REVIEW → HIRING`.

**Post-hire expansion is FROZEN** (details below).

---

## Current application-mode direction (R2 — IMPLEMENTED)

One canonical, opportunity-wide `application_mode` (`opportunities.application_mode` enum, migration `0027`):

- **QUICK APPLY** (`quick_apply`) — no Challenge required. May publish with no challenge at all. Company evaluates on profile evidence.
- **OPTIONAL CHALLENGE** (`optional_challenge`) — application is submitted immediately. Challenge is genuinely optional: skipping it is **never** treated as failure/incomplete/invalid, never a red/amber warning, never blocks shortlist or offer. Publishing this mode still requires a real approved Challenge.
- **CHALLENGE REQUIRED** (`challenge_required`) — the application record is created immediately, but the company **cannot shortlist or send an offer** until a valid final submission (`submissions` row) exists.

**Fairness rule:** the requirement is a property of the *opportunity*, applied uniformly. There is **no** "strong CV skips the Challenge / weak CV must prove itself" path. Never build one.

**New-opportunity default:** `optional_challenge` (locked owner decision).

**Server-side enforcement (single shared checks in `src/lib/opportunities/actions.ts`):**
- `assertChallengeRequirementMet` — called from `shortlistApplicationAction` and `inviteToInternshipAction`. Clears on a bare `submissions` row only. A started-but-not-submitted session never clears it. **AI evidence evaluation is NOT required** to clear it (a provider outage must never block hiring).
- `ensureChallengeReadyForPublish` — shared publish gate for both real publish entry points (`publishOpportunityAction` from ChallengeBuilder, and `saveInternshipAction`'s `publish:true` path from the manual form). `quick_apply` skips it.
- `updateApplicationModeAction` — canonical way to change mode after creation (`ApplicationModeSettings` panel on the opportunity page). Switching a published opportunity to optional/required requires a real approved Challenge; switching to `quick_apply` or editing a draft is always safe and never deletes Challenge data. Historical shortlists/hires are never retroactively re-gated.

**Display (R2 §12):** `applicationStage` (pure hiring pipeline) and `challengeState` (separate, mode-aware; `null` for `quick_apply`) are two separate rows everywhere. Optional-not-attempted renders in a plain neutral badge — never the old amber "Challenge to complete" warning.

---

## Challenge principles

Challenges remain. The potential future UI name "Skill Proof" is **NOT approved for implementation** — keep calling them Challenges.

A Challenge means: realistic company-style problem → actual work → artifact → validation → evidence → human review. **Not** question → answer → AI score. Artifacts are central; MCQs are not core assessments.

Every Challenge should be able to answer: (1) what ability are we assessing, (2) what artifact would expose it, (3) how can that evidence be checked, (4) what can this Challenge provide evidence for, (5) what can it NOT establish.

### R3 — bounded No-Free-Labor safeguards — IMPLEMENTED

R3 is the safety boundary around the **current** Challenge system; it is not the full Challenge Architect redesign. Every new/edited Challenge version is policy version 2 and publication requires a version-bound non-production basis (`synthetic`, `fictional`, `historical_adapted`, `sandbox`, or `anonymized_adapted`), an authenticated company user's explicit confirmation, and compliant estimated **active-work** time. More than 90 minutes requires a meaningful justification; more than 120 minutes cannot be approved or published as a normal unpaid assessment.

`ensureChallengeReadyForPublish` remains the canonical mode-aware publish gate and now applies the R3 checks for optional/required Challenges. `quick_apply` remains unaffected. Approval also checks the same pure guard before recording actor/time on the immutable approved version. Human confirmation is never accepted from AI output and is reset by content edits. Meaningful confirmation and duration-exception events are written to `event_log`.

AI Challenge generation now returns structured potential-production-work metadata. When the model reports a possible/high concern, a deterministic postcondition requires `transformationApplied=true` and a truthful non-production basis before the draft can be stored. Prompts require equivalent synthetic/adapted/sandbox work and forbid live confidential records/credentials/secrets. This classification is a potential concern, not certainty, and the final safety boundary does not depend on OpenRouter being available.

Historical versions remain policy version 1 with null R3 metadata. Migration `0028` does **not** fabricate an attestation or unpublish the 11 existing published opportunities. An untouched already-published legacy record may remain live; a new/edited version must pass R3 before approval/publication.

The schema still has no separate Challenge completion-window/deadline model. `estimatedMinutes` is explicitly treated and shown as active-work time; R3 did not expand the deadline model.

---

## Approved future directions — NOT yet implemented

- **Ten-characteristic framework** (physical work / real humans / safety-critical decisions / specialized equipment / legal authority / real-world unpredictability / confidential information / long time horizons / team dependency / real consequences). Future Challenge-Architect AI should classify a role as digitally-assessable / human-review-required / practical-verification-required / not-meaningfully-assessable-digitally. **Not built.**
- **AI provenance** for OBSERVED internIn AI usage. internIn cannot fully know whether someone used *external* AI — never claim universal AI detection. Similarity ≠ AI detection. No automatic cheating verdict. **Not built.**
- **Objective-validation architecture** (deterministic checks beyond AI rubric). **Not built.**

---

## Credential / endorsement current state (R1 — COMPLETE)

Public-facing name: **internIn Challenge Evidence Credential**. The base credential is an internIn evidence/validation result. It does **NOT** mean company endorsement or universal skill verification.

**Company endorsement** is: explicit human action only; capability-scoped (a server-validated subset of the credential's own frozen rubric snapshot); requires a real per-opportunity `certificate_approver` assignment **plus** appropriate company permission (neither alone); cannot be produced automatically by policy/issuance/confirmation/AI/shortlist/offer/hire; independent from shortlist/offer/hire. Do **not** describe the old automatic-endorsement behavior as current — it was a defect, fixed in R1.

**Key implementation concepts:**
- `opportunity_responsibility_assignments` (migration `0026`) — **PRE-HIRE** responsibilities on a specific opportunity: `hiring_owner`, `challenge_owner`, `reviewer`, `certificate_approver`.
- `programSupervisorAssignments` (migration `0024`) — **POST-HIRE** supervision. **Never merge these two concepts.**
- The one place `companyEndorsed` may become true: `grantCredentialCompanyEndorsement` in `src/lib/credentials/company-endorsement.ts`, via `grantCredentialCompanyEndorsementAction`.

---

## Post-hire — PRESERVE but FREEZE

Substantial post-hire infrastructure already exists and **must not be deleted**:
`internshipPrograms`, `internshipWeeks`, `internshipTasks`, `supervisorFeedback`, `verifiedExperience`, `programSupervisorAssignments`.

- **Phase 6A** (`229c007`) — supervisor access hardened to assignment-scoped.
- **Phase 6B** (`96951c2`) — Student Active Internship Workspace. Route: `src/app/student/(dashboard)/internships/` (list) and `.../internships/[programId]/` (workspace: Overview / My Work / Timeline / Check-ins / Feedback). Task blocker + evidence functionality exists (migration `0025`).
- **Check-ins status (honest):** No full check-in data model was implemented in Phase 6B. The tab exists as a placeholder/proposal only. Do not assume Check-ins is production-complete because a tab is present.

The current master direction **FREEZES** further expansion of: full Supervisor Workspace, attendance/geolocation, more task management, employee collaboration, Student Agent, Supervisor Agent, post-hire analytics — until the hiring/evidence core is proven.

---

## Infrastructure

- **Vercel** — Next.js 16 (App Router) frontend + server actions. Production: **https://www.internin.app**
- **Supabase** — PostgreSQL, Auth (`@supabase/ssr`), Storage. Postgres RLS is a real enforcement boundary for any table reachable via the browser Supabase client.
- **Railway** — existing persistent Fastify/TypeScript backend foundation for future long-running AI / workers / integrations. Not touched by recent phases.
- **Cloudflare** — DNS/domain.

Do not migrate hosting.

## Storage / security principles

Strict authorization on every server action; private submission-artifact and challenge-resource buckets; signed URLs minted per-request after an ownership check (never persisted); private certification-document bucket; cross-company and cross-student isolation enforced in the canonical server actions, not just the UI. Never trust a client-supplied `applicationMode` / mode / role.

---

## Stack (locked — do not swap without asking)

Next.js 16 App Router + TypeScript, Tailwind v4 + shadcn/ui (**Base UI, not Radix**), Motion, Drizzle ORM + Supabase Postgres, Supabase Auth, Vercel AI SDK (`generateObject`) + OpenRouter (model via `AI_MODEL` env), Zod at every AI I/O and server-action boundary, Vitest. Not using: FastAPI/microservices, Redis, Kubernetes, GraphQL, a vector DB, Prisma.

---

## Migration checkpoint (hand-written SQL + paired `scripts/apply-*.mjs` idempotent appliers)

Latest meaningful migrations:
- `0023_challenge_credentials.sql` — credential core.
- `0024_program_supervisor_assignments.sql` — post-hire supervisor assignment scoping.
- `0025_internship_task_evidence.sql` — internship task evidence / blocking.
- `0026_company_endorsement_honesty_fix.sql` — R1: `opportunity_responsibility_assignments` (pre-hire), `challenge_credentials` grant/withdrawal audit columns.
- `0027_application_modes.sql` — R2: `application_mode` enum + `opportunities.application_mode` (default `optional_challenge`) + conservative backfill (challenge-less → `quick_apply`, all others keep the default; never `challenge_required`).
- `0028_no_free_labor_safeguards.sql` — R3: assessment-basis / model-risk enums and immutable-version safety metadata, version-bound company confirmation, and duration-exception justification. Additive only; historical rows remain honest policy-version-1 records.

Through `0027` is applied to production. `0028` is included in the R3 release and is pending the release-time migration step at this pre-commit handoff checkpoint.

---

## Commit checkpoints (actual SHAs)

- Phase 6A: `229c007`
- Phase 6B: `96951c2`
- R1 (company endorsement honesty fix): `301a405`
- R2 (application modes + fairness): `69a198122238d776aa506e221d047b5cbd25536c`
- R3: pending final commit at this pre-release handoff checkpoint.

---

## Test baseline (R3 pre-release verification)

Final full suite: **475 passed, 1 skipped, 19 failed** (of 495).

The **19 failures exactly match the R2 baseline** and are live-AI integration tests failing on `AI_APICallError: Insufficient credits` (OpenRouter credit exhaustion) — `assistant-router.integration.test.ts`, `clarification-wording.integration.test.ts`, `role-intelligence.integration.test.ts`. Do **not** call any test "pre-existing" without checking it against the current run.

R3 verification: `npx tsc --noEmit`, touched-file ESLint, focused R3/Challenge/application/credential tests, `next build --webpack`, and `git diff --check` are green. The final full run includes all deterministic and database-backed coverage. The default Turbopack `npm run build` cannot create its internal worker process on this Codex host because the worker attempts to bind a local port (`EPERM`); the supported webpack build compiles, type-checks, generates all 32 static pages, and completes successfully.

## OpenRouter / AI provider limitation

Some live AI integration tests/actions fail because OpenRouter credits are exhausted. Live R3 AI transformation could therefore not be exercised against the provider in this phase. Prompt/schema/postcondition tests are green, and the complete manual/deterministic safety path stays functional without an AI call. Do not use provider failure to skip manual/non-AI paths.

---

## Design state (high-level, approved)

**Student:** premium-consumer feel. Home / Explore / Applications / Profile. Profile is one continuous main surface (not card soup), sticky desktop left rail. Explore uses a permanent desktop split view. The Student Active Internship Workspace exists but is frozen from further expansion.

**Company:** one Company Portal, one hiring workspace, permission + assignment driven. No separate apps for HR/reviewer/admin/supervisor. No giant hero/dashboard redesign.

Full design spec: `design-system/internin/MASTER.md` (forbids gradients/glow/glassmorphism/generic SaaS card grids/fake browser mockups/big sparkle icons) and `.../pages/landing.md`.

---

## Canonical architecture docs

- `docs/13-honesty-evidence-product-alignment.md` — **current HONESTY/evidence master alignment + delta report.** Read first for any evidence/credential/application-mode work. Contains the R1 (`§2.Q1`) and R2 (`§2.F1`) implementation status notes.
- `docs/12-verified-challenge-credentials.md` — credential architecture (schema, issuance, endorsement, PDF, public verification). Carries the R1 correction note.
- `docs/00-product-concept.md` … `docs/11-agentic-architecture-direction.md` — original negotiated product spec; still binding for scope/mechanics. `docs/11` is binding for all AI work.
- `design-system/internin/MASTER.md` — UI direction; read before any UI change.

---

## Directions that are no longer current

- Challenge is **NOT** universally mandatory. Application mode is per-opportunity (`quick_apply` / `optional_challenge` / `challenge_required`).
- The old assumption "every published opportunity requires an approved challenge" is **overridden** — `quick_apply` publishes with none.
- Company endorsement is **NOT** automatic (was a defect; fixed in R1).
- "Verified" must not imply universal skill verification. Prefer "internIn Challenge Evidence Credential".
- internIn is **NOT** anti-CV — profile evidence is a first-class input.
- Do **NOT** build a global suitability score.
- Do **NOT** claim external AI usage can be fully detected.
- Do **NOT** use `programSupervisorAssignments` for pre-hire reviewer/certificate roles (use `opportunity_responsibility_assignments`).
- Do **NOT** build a cohort migration for InternshipProgram.
- Do **NOT** rewrite working Phase 6A/6B / R1 / R2 / R3 architecture.
- Post-hire expansion is **frozen**.

---

## Dirty worktree / session state (at R3 pre-release handoff)

- Branch: `main`. Starting R3 HEAD and `origin/main` were both `69a198122238d776aa506e221d047b5cbd25536c` (R2).
- Intentional unrelated dirty files that must be preserved (present since before R1, not part of any phase): `vault/.obsidian/graph.json` (modified), and untracked `.agents/`, `.codex/`, `.mcp.json`, `.playwright-cli/`, `.playwright-mcp/`, `seed.spec.ts`, `skills-lock.json`, `specs/`. Do not stage or commit these.
- `0027` is applied to production. `0028` is prepared and pending the authorized release-time application step.
- No synthetic R3 QA data or auth users have been created at this checkpoint.
- `AGENTS.md` may show as dirty — it is re-written by `next dev` on every run; commit it with your work if it appears, or leave it.

## Database / production state (R3 pre-release)

- Latest migration successfully applied to production: `0027_application_modes.sql` (verified idempotent; all 11 existing opportunities backfilled to `optional_challenge`).
- R3 read-only audit before migration: 11 Challenges / 11 opportunities, all published; all opportunities `optional_challenge`; published active-work estimates range from 60 to 150 minutes (one 150-minute legacy version, three 120-minute versions); no pre-existing field represented assessment basis or human no-free-labor confirmation. `0028` deliberately leaves all historical version rows at policy version 1 with null confirmation metadata.
- R3 deployment/migration status at this mandatory pre-commit checkpoint: not yet released; `0028` must be applied after the R3 commit is pushed and before production verification.
- Production URL: https://www.internin.app
- Deployed SHA: verified by functional check post-deploy (see R2 final report for the exact SHA and the check used). Vercel CLI is not installed in this environment, so the deployment ID itself is not queried directly.

---

## If continuing with Codex / another agent

- Do not ask the owner to re-explain internIn unless this file and the docs genuinely lack required information.
- Read this file, then `docs/13-honesty-evidence-product-alignment.md`, then the architecture doc relevant to the active phase.
- Inspect `git status` and `git log` before edits. Preserve unrelated dirty files.
- Verify current schema/code instead of trusting stale prose.
- Never undo completed phases because an older doc conflicts.
- Current owner instructions always override this file.
- Report uncertainty instead of fabricating implementation state.
- This file must be updated **before the final commit** of every completed major phase — new work, schema/migrations, commit checkpoint, test baseline, deployment status, new limitations, what is frozen, and the exact NEXT TASK.

---

# NEXT TASK

**Current phase: R3 — No-Free-Labor Safeguards — COMPLETE in implementation and deterministic verification; release steps pending at this pre-commit checkpoint.**

- Scope: bounded safeguards on the current Challenge system only. This is not the full Challenge Architect / ten-characteristic redesign.
- Schema: additive migration `0028`; no destructive or fabricated historical backfill.
- Code: structured AI production-work concern/transformation output without exposing or requesting chain-of-thought; manual assessment-basis and attestation controls; explicit version-bound company confirmation; one canonical publish gate; and 90/120-minute active-work rules. Students receive only a concise “Assessment exercise” basis indicator.
- Tests: final full suite 475 passed / 1 skipped / 19 known OpenRouter-credit failures. The 19 failures exactly match the R2 live-provider baseline and are blocked by the account's explicit `Insufficient credits` response; deterministic, database-backed, and R3 safeguard coverage passed.
- Provider limitation: live OpenRouter transformation QA unavailable due exhausted credits; manual/deterministic path verified without AI.

**DO NOT automatically begin R4.**

**Next planned phase: R4 — Challenge Architect + role reality + ten-characteristic + can/cannot-establish framework — AWAITING OWNER APPROVAL.** Objective validation, AI provenance, similarity/integrity, and post-hire expansion also remain out of scope/not started.
