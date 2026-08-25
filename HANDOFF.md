# internIn — Handoff to Codex

This is a working handoff, not marketing copy. Read it in order. Everything here was verified against the actual repo state at handoff time (`npm run build`, `npm run test` both green).

## 1. What internIn is

internIn is an early-career hiring and internship platform where students with little or no prior experience prove themselves through realistic company work challenges. Companies describe an internship role and the real work an intern would do to an AI assistant, which generates a safe, simulated Challenge (synthetic data, fictional company — never real internal data). Students complete the challenge; companies review evidence of performance instead of relying on a CV. A company can invite a strong candidate into an internship, at which point internIn generates a structured week-by-week internship program, tracks it, and issues Verified Experience when it's done.

**Core principle, non-negotiable:** AI never makes the hiring decision, and AI-generated content never auto-publishes. Every Challenge goes through an explicit human approval gate (`draft → ai_generated → pending_approval → approved → published`) before a student can see it.

**Anti-exploitation rule, non-negotiable:** pre-hiring Challenges must be synthetic/sanitized/limited. Companies cannot use internIn to extract free production work — if the output would create real production value, it has to become paid work instead.

**Monetization (decided, not TBD):** students always free (no pay-to-win). Companies: free to start (create internships, generate Challenges, review candidates), then **QAR 499 per successful intern hired** — that fee is what unlocks the Internship Program Builder and management tools. No AI-credit pricing, ever — companies should feel like "internIn created my challenge," not "I consumed tokens." The QAR 499 charge itself is intentionally **stubbed** for v1 (no real Stripe integration yet — see `internship_offers.placementFeeStatus` enum: `unpaid | stubbed_paid | paid`).

Full original product spec (this is the source of truth for scope/behavior, read it before changing product behavior): **`docs/00-product-concept.md` through `docs/10-brand-identity.md`**. Ten files, each covering one slice (company flow, student flow, candidate evidence, internship builder, anti-exploitation, monetization, landing page copy, page list + data model, AI architecture, brand identity). Don't re-derive these from scratch — they were carefully negotiated with the founder across several plan revisions.

## 2. Brand identity

- Wordmark: use `/public/logo.png` (already transparent-background, correctly cropped). **Never redraw, recolor, or re-crop it, and never put it in a decorative chip/box.** This was gotten wrong twice earlier in the project (a hand-drawn text approximation, then a botched background-removal script that corrupted the original file) — the founder was rightly frustrated both times. The current `logo.png` is correct and confirmed by the founder. Leave it alone.
- Colors: navy `#213248` (text, structure), teal `#1BA59C` (sparing accent — primary actions, status, one closing band), light gray `#F3F5F7`, cool gray `#C7CDD3`.
- Full design system spec: **`design-system/internin/MASTER.md`** (direction, type scale, layout rhythm, motion dial, forbidden patterns) and **`design-system/internin/pages/landing.md`** (landing-page-specific). Read `MASTER.md` before touching any UI — it explicitly forbids gradients/glow/glassmorphism/generic SaaS card grids/fake browser mockups/big sparkle icons, which is exactly the "looks AI-generated" failure mode this project has been actively steering away from.
- Full brand kit sheet at `BrandKit.png` (root) if you need the original reference.

## 3. Stack (locked — do not swap without asking)

Next.js 16 (App Router) + TypeScript, Tailwind v4 + shadcn/ui (**this shadcn version runs on Base UI, not Radix** — see gotcha #1 below), Motion (+ GSAP sparingly), Drizzle ORM + PostgreSQL via Supabase, Supabase Auth (`@supabase/ssr`), Vercel AI SDK (`generateObject`) + OpenRouter for the real AI provider with model set via `AI_MODEL` env var (never hardcoded), Zod for every AI I/O boundary and every server action input, Vitest for tests. Explicitly **not** using: FastAPI/microservices, Redis, Kubernetes, GraphQL, a vector DB, Prisma.

## 4. Repo layout

```
internIn/
  docs/                      product spec, source of truth — read before changing behavior
  design-system/internin/    UI direction spec — read before changing UI
  vault/                     Obsidian knowledge-graph vault of the product spec (graphify output)
  graphify-out/              graphify's raw graph data/report
  BrandKit.png, logo.png     brand assets — logo.png is also copied to public/
  public/logo.png            the actual asset the app renders (transparent, cropped)
  src/
    app/
      (marketing)/           landing page + /pricing — public
      (auth)/                /signin, /signup, actions.ts (Supabase Auth)
      company/
        page.tsx             redirects to /company/dashboard
        dashboard/            real, DB-backed, protected
        opportunities/new/    the Create-Internship wizard — protected, writes to DB
        layout.tsx
    components/
      marketing/              landing-page.tsx assembles hero/role-demo/sections
      opportunities/          create-internship-wizard.tsx (the multi-step flow)
      challenges/             challenge-builder.tsx (edit/approve/publish UI)
      ai/                     thinking-indicator.tsx
      ui/                     shadcn primitives + wordmark.tsx (uses the real logo)
    lib/
      ai/                     provider.ts (interface), schemas.ts (Zod), mock-provider.ts,
                               gemma-provider.ts (real), index.ts (swap point), actions.ts (server actions)
      opportunities/actions.ts  DB persistence server actions (create/save-version/publish)
      supabase/               client.ts, server.ts, middleware.ts (session + route protection)
      auth.ts                 getCurrentUser / requireCurrentCompanyMember / requireCompanyMember
      utils.ts                shadcn's cn()
    db/
      schema.ts               Drizzle schema, 17 tables
      migrations/              generated SQL (0000_zippy_terrax.sql) — not yet pushed anywhere
      index.ts                 getDb() — lazy, throws clearly if DATABASE_URL unset
    proxy.ts                  route protection (Next.js 16 renamed "middleware" → "proxy";
                               the build output literally prints "ƒ Proxy (Middleware)" — do not
                               recreate a src/middleware.ts, it will silently not run)
  drizzle.config.ts
  vitest.config.ts
  .env.local.example
```

## 5. What actually works right now

- **Landing page** (`/`) — redesigned past the original v1; follows `design-system/internin/MASTER.md`. Editorial/base.org-inspired rhythm, not generic SaaS.
- **`/pricing`** — static, matches the monetization section above.
- **Auth**: `/signup` (role toggle: student vs company; company signup creates a `companies` row + `company_members` owner row), `/signin`, sign-out action. Session cookies via `@supabase/ssr`.
- **`/company/dashboard`** — real, protected, server component. Reads the signed-in user's company + opportunities from Postgres via Drizzle. Empty state links to the wizard.
- **`/company/opportunities/new`** — the full Create-Internship → AI Challenge Builder wizard, **now protected and DB-wired, not a client-only demo**:
  1. Describe role in plain language → `generateInternshipAction` (AI) → structured `InternshipDraft`
  2. Review/edit the draft → on "Continue," `createOpportunityAction` inserts a real `opportunities` row (status `draft`)
  3. Describe the actual work → `generateChallengeAction` (AI) → a `Challenge`, immediately persisted via `saveChallengeVersionAction` as `challenge_versions` version 1 (`source: "ai_generated"`)
  4. Challenge Builder: manual field edits are local-only (no DB write per keystroke); the "Tell the AI what to change" box calls `editChallengeAction` then persists a new version (`source: "ai_generated"`, `editInstruction` recorded); **Approve** persists a version with `source: "approved"`; **Publish** flips `challenges.status` and `opportunities.status` to `published` and writes an `event_log` row.
- **Real AI provider** (`gemma-provider.ts`) — OpenRouter via `generateObject`, model from `AI_MODEL`. Auto-selected in `src/lib/ai/index.ts` when `OPENROUTER_API_KEY` is set; falls back to `mock-provider.ts` (deterministic, templated, no network call) otherwise, so the whole flow above works with zero external credentials for demos.
- **Server-side authorization**: `src/lib/auth.ts` + `src/lib/opportunities/actions.ts` — every write resolves the session's company membership itself and throws if it doesn't match, rather than trusting a client-supplied id.
- **Tests**: `npm test` — 28 tests on the AI provider layer (mock provider's template selection, instruction parsing, status transitions, notes-grounded candidate summaries), 100% line coverage on `mock-provider.ts`. `npm run test:coverage` for the full report.
- **DB schema**: 17 tables, two migrations generated (`0000_zippy_terrax.sql`, `0001_blushing_morgan_stark.sql` — adds `submissions.notes`), **pushed to a live Supabase project** (`qdlrrqjevcvjtkbsezaj`, org `loaiahmedgit's Org`, region `ap-south-1`) — see section 11 below for connection details and a real gotcha hit getting there.
- **Student flow (Phase 3, minimal vertical slice)**:
  - `/opportunities` — public browse page, lists `published` opportunities joined with company name. `force-dynamic` (no `cookies()` call, would otherwise statically prerender at build time and crash without `DATABASE_URL`).
  - `/opportunities/[id]` — detail page + `ApplyButton` client component, calls `applyToOpportunityAction` (`src/lib/opportunities/student-actions.ts`), redirects to the new application's workspace. Also `force-dynamic`.
  - `/student/dashboard` — protected, lists the signed-in student's applications with company/role/status.
  - `/student/applications/[id]` — protected challenge workspace: renders the opportunity's current published `challenge_version` (scenario, tasks, deliverables) and either a `SubmitChallengeForm` (calls `submitChallengeAction`) or, once a submission exists, its status.
  - `requireCurrentStudent()` added to `src/lib/auth.ts`, mirrors `requireCurrentCompanyMember()`.
  - `src/lib/supabase/middleware.ts`'s `isProtected` now also covers `/student/dashboard` and `/student/applications` (same `!user` check as company routes — no role check yet, matching existing pattern).
  - Not done: no Smart Matching/scoring (docs/02); no file upload (Supabase Storage) — submission is a URL + notes only; no resubmission flow if a company requests changes.
- **Student Profile page** (docs/02 + docs/08's explicit MVP "Build" list — the last unbuilt item from that list):
  - `/student/profile` — view/edit university, major, graduation year, availability, skills, interests (comma-separated text inputs, parsed to arrays), and an optional CV link. `StudentProfileForm` (client) calls `updateStudentProfileAction` (`src/lib/opportunities/student-actions.ts`), which just updates the `student_profiles` row `/signup` already created (never inserts — one profile per user is guaranteed at signup, `userId` is unique).
  - Deliberately kept minimal per docs/02's own philosophy ("internIn shouldn't punish someone for not already having an impressive CV") — no résumé parsing, no required fields, CV link is optional. Linked from `/student/dashboard`'s header alongside Verified Experience.
  - Not done: profile data isn't used for anything yet (no Smart Matching against it, no display of it to companies) — it's captured but not yet consumed anywhere.
- **Candidate Evidence page (company side)**:
  - `/company/opportunities/[id]` — company-owned opportunity detail: lists applications with a "View evidence" link per submission.
  - `/company/submissions/[id]` — the actual Candidate Evidence page from `docs/03`: factual data first (tasks completed, time spent, AI usage mode, company rubric, submission notes + "View original work" artifact links), then an AI summary section (descriptive strength/watch-for, never a bare score) with a `GenerateEvidenceButton` that calls `generateCandidateEvidenceAction` (`src/lib/opportunities/evidence-actions.ts`).
  - Fixed a real gap found while building this: `summarizeCandidateAction`/the AI providers previously fabricated evidence from the challenge template alone, ignoring the actual submission — the exact TODO `gemma-provider.ts` had left for "once real submissions exist (Phase 3)". `AIProvider.summarizeCandidate` now takes `submissionNotes` and both providers ground their output in it. `submissions` gained a real `notes` column (was previously only in `event_log.metadata`, unqueryable) — migration `0001_blushing_morgan_stark.sql`.
  - Factual fields (`tasksCompleted`, `timeSpentMinutes`) are computed server-side from real data (task count, `submittedAt - application.createdAt`) and never taken from the AI's output — only the descriptive summary/strength/weakness text is AI-generated. `candidate_evidence` upserts on `submissionId` (unique), so regenerating updates the same row.
- **Candidate Comparison page (company side)**:
  - `/company/opportunities/[id]/compare` — only reachable once 2+ submissions on that opportunity have generated evidence (linked from `/company/opportunities/[id]` as "Compare candidates"). Server component loads every application whose submission already has a `candidate_evidence` row; anyone without one is silently excluded (comparison never triggers generation itself — it's a read/derive step, not a place to silently run AI on submissions the company hasn't looked at yet).
  - `CandidateComparisonView` (client): checkbox-select 2+ candidates → `compareCandidateSubmissionsAction` (`src/lib/opportunities/evidence-actions.ts`) rebuilds `CandidateEvidence` objects from the DB rows (candidateName joined from `users`, `submissionSummary` derived from artifact count since that field isn't persisted in `candidate_evidence`) and calls the existing `compareCandidatesAction` AI wrapper. Table isn't persisted — it's a live comparison, recomputed each time.
  - Each row has a **Shortlist** button → `shortlistApplicationAction` (`src/lib/opportunities/actions.ts`), sets `applications.status = "shortlisted"` after re-verifying the company owns the application's opportunity, logs `event_log`.
  - **Invite to Internship** is available from both this table's rows and the evidence page (see below) — deliberately not duplicated here.
  - Deliberately still not built: **Request interview** (no matching `application_status` value in the schema — would need a new enum value, not attempted).
- **Invite to Internship (company side, docs/03 "the defining moment" + docs/06 monetization)**:
  - `InviteToInternshipButton` (`src/components/opportunities/invite-to-internship-button.tsx`) — on `/company/submissions/[id]` (the evidence page) and on each row of `/company/opportunities/[id]/compare`. Opens a confirmation dialog that names the **QAR 499 placement fee** explicitly before doing anything, per docs/06's requirement that the fee visibly trigger, not happen silently.
  - `inviteToInternshipAction` (`src/lib/opportunities/actions.ts`) — re-verifies company ownership of the application, inserts an `internship_offers` row (`status: "pending"`, `placementFeeStatus: "stubbed_paid"` — the fee is stubbed per the MVP decision, but the state is set immediately rather than left `"unpaid"`, since the point is to prove the "pay when you hire" thesis end to end), flips `applications.status` to `"invited"`, logs `event_log` with `{ placementFeeStatus, placementFeeQar: 499 }`. Idempotent — calling it again on an already-invited application just returns the existing offer id (`internship_offers.applicationId` is unique).
  - No real payment processor (intentionally out of scope per docs/06 — v1 is stubbed only).
- **Student offer accept/decline (docs/03 flow closure)**:
  - `/student/applications/[id]` now shows an offer banner whenever an `internship_offers` row exists for that application: pending → `OfferResponseButtons` (Accept/Decline); accepted/declined → a plain status line, no buttons.
  - `respondToOfferAction` (`src/lib/opportunities/student-actions.ts`) — reuses `assertOwnsApplication`, requires `offer.status === "pending"` (rejects re-deciding an already-answered offer), sets `internship_offers.status` to `"accepted"`/`"declined"`. On decline, also flips `applications.status` to `"declined"` (there's no `applications.status` value for "accepted" — `offer.status` alone carries that signal, `applications.status` just stays `"invited"`). Logs `event_log` (`offer_accepted`/`offer_declined`).
  - Not done: nothing happens on acceptance beyond the status flip — no notification to the company.
- **Internship Program Builder (docs/04)**:
  - `/company/offers/[id]/program/new` — only reachable once the offer is accepted (checked server-side, not just hidden in the UI) and only if no program exists yet for that offer (`internshipPrograms.offerId` is unique — redirects to the view page if one already exists). `InternshipProgramWizard` (client): manager sets duration/hours-per-week and describes the internship in free text → `generateInternshipProgramAction` (existing AI action, unchanged) drafts week-by-week `title`+`objectives` → every field is editable inline before anything is saved (AI proposes, the company controls — no separate approval-gate table was added here since, unlike student-facing Challenges, this content never reaches a student unreviewed; the wizard's own review step is the gate).
  - `createInternshipProgramAction` (`src/lib/opportunities/actions.ts`) — re-verifies company ownership via `offer → application → opportunity.companyId`, requires `offer.status === "accepted"`, rejects a second program for the same offer, inserts `internship_programs` (`status: "active"`) + one `internship_weeks` row per week, logs `event_log`.
  - `/company/offers/[id]/program` — read view of the created plan (week/title/objectives). Linked from `/company/submissions/[id]` once the offer is accepted ("Build internship program" / "View internship program" depending on whether one exists yet).
  - Student side: `/student/applications/[id]` renders the same week-by-week plan read-only once accepted — reused the existing per-application page rather than building a separate "Internship Workspace" route.
  - Deliberately not built (scoped down from docs/04's full ask): no drag-to-reorder or "tell the AI what to change" edit-by-instruction for programs (unlike the Challenge Builder).
- **Supervisor task tracking & feedback (docs/04 "Internship Workspace")**:
  - `src/lib/opportunities/program-actions.ts` — `addInternshipTaskAction`, `updateInternshipTaskStatusAction`, `addSupervisorFeedbackAction`. Since the AI-generated program only has week `title`+`objectives` (no tasks — `InternshipProgramSchema` has no task field), tasks are added manually by the company per week; there's no "supervisor" role distinct from company member in the schema, so any company member of the owning company can add tasks, cycle their status (`pending → in_progress → done → pending`), and post feedback (optionally attached to a week). Every action re-derives ownership by joining week/program → offer → application → `opportunities.companyId`, never trusting a client id.
  - `/company/offers/[id]/program` now renders `InternshipTaskList` per week (inline add + click-to-cycle status) and an `AddFeedbackForm` + feedback timeline at the bottom (author name, optional week tag, newest first).
  - `/student/applications/[id]`'s program section is the read-only mirror: task status badges per week (strikethrough when done) and the same feedback timeline — students see progress and feedback but can't add either.
  - Not done: no drag/reorder or edit/delete on tasks or feedback (add + status-cycle only); no per-task assignee or due date; no distinct supervisor role/permission (any company member can act).
- **Verified Experience (docs/04 closing step)**:
  - `completeInternshipProgramAction` (`src/lib/opportunities/program-actions.ts`) — flips `internship_programs.status` to `"completed"` (rejects a second completion — `programStatusEnum` has no "re-open"), then inserts one `verified_experience` row. `workCompleted` is built from tasks the supervisor actually marked `"done"` (falls back to week titles if none were tracked, so the record is never empty); `skillsDemonstrated` comes straight from the opportunity's own declared `skills` — neither field is AI-invented, both are facts already in the database. Completing the program **is** the supervisor verification act (`supervisorVerified: true`, `verifiedAt: now`) — there's no separate multi-step approval, matching the "any company member" trust level already used for tasks/feedback on this program.
  - `CompleteProgramButton` — confirmation dialog (mirrors `InviteToInternshipButton`'s pattern) warning it can't be undone, shown on `/company/offers/[id]/program` only while `status === "active"`.
  - Both `/company/offers/[id]/program` and `/student/applications/[id]` render the same record once it exists: role + duration + "Verified", work completed (bulleted), skills demonstrated (chips) — deliberately not a bare "Certificate of Completion," per docs/04's explicit anti-pattern.
  - `/student/experience` — the portfolio: every one of the student's `verified_experience` records across all internships, newest-verified first, each card linking back to its `/student/applications/[id]` for full week-by-week detail. Linked from `/student/dashboard`'s header. Empty state points back to the applications list rather than showing nothing.
  - Not done: no way to un-complete/edit a record after the fact (matches "immutable record" intent, but also means a mistake can't be corrected without a DB edit); no public/shareable version of the portfolio (it's behind student auth only, per `requireCurrentStudent`).

## 6. What's NOT done (the actual next work, in priority order)

1. **Real OpenRouter testing still hasn't happened.** `OPENROUTER_API_KEY` is still unset — the app runs fully on the mock AI provider. Supabase (DB + Auth) is now live; AI is the one credential still missing.
2. **Supabase Auth email confirmation is still the default (ON).** A student/company created via `/signup` gets a real `auth.users` row but can't sign in until they click the confirmation email — and no email provider is configured yet (that's Phase 6/Resend), so **no confirmation email will actually arrive**. For demoing signup end-to-end before Resend is wired up, either flip "Confirm email" off in Supabase Dashboard → Authentication → Providers → Email (fine for a demo project, not for production), or manually confirm the user row from the dashboard.
3. Email (Resend), analytics (PostHog), error tracking (Sentry), background jobs (Inngest for slow AI generation) — none installed, deliberately deferred to last (see cross-cutting note below).

The full company → AI Challenge → student submission → evidence → comparison → invite → accept → program → tasks/feedback → Verified Experience → student portfolio loop (docs/00–04) now has a working vertical slice end to end, and it's backed by a real, live Supabase database (see section 11). What's left is real AI credentials (item 1), the email-confirmation demo wrinkle (item 2), and Phase 6 plumbing (item 3) — see `docs/08-page-list-and-data-model.md` for anything not yet covered here (Discover/Smart Matching scoring, real Supabase Storage file upload).

## 7. Cross-cutting rules to keep following (don't relax these)

These came from explicit founder pushback on an early plan draft — they're not my invention, they're requirements:

- **AI model via env var, never hardcoded.** `gemma-provider.ts` reads `AI_MODEL`; don't put a model string anywhere else.
- **Auditability**: AI generations and edits are never overwritten in place. Every meaningful change is a new `challenge_versions` row (see `saveChallengeVersionAction`). Keep this pattern for the Internship Program equivalent when you build it.
- **Explicit approval gate**: nothing AI-generates its way to `published`. Keep the status enum discipline.
- **Real server-side authorization**, not just a join table existing — every DB action re-derives "does this session actually own this row" itself (see `requireCurrentCompanyMember`, `assertOwnsOpportunity`). Follow the same pattern for student-side actions (a student must never be able to read another student's submission).
- **`created_at`/`updated_at` + an append-only `event_log`** on everything that matters. The `event_log` table is generic (`entityType`, `entityId`, `eventType`, `actorUserId`, `metadata` jsonb) — keep using it rather than inventing per-feature audit tables.
- **`candidate_evidence.rubricVersionId`** must pin the exact `challenge_versions` row used to evaluate a submission, so editing a rubric later never silently changes a historical evaluation. The column exists; make sure whatever writes `candidate_evidence` actually sets it correctly.
- **Don't over-install plumbing early.** Resend/PostHog/Sentry/Inngest are Phase 6, on purpose — don't add them "since they're in the stack" before the phase that needs them.
- **Every phase should ship something demonstrable**, not just infrastructure. This is why Phase 1 was a working mocked demo before any DB existed, and why Phase 2 wired real persistence into the *existing* wizard rather than building a parallel admin panel nobody would see.

## 8. Gotchas actually hit this session (save yourself the time)

1. **shadcn here uses Base UI, not Radix.** `<Button>` has no `asChild` prop. Polymorphic rendering is `<Button render={<Link href="..." />} nativeButton={false}>text</Button>` — you need **both** `render` and `nativeButton={false}`, or Base UI logs a console error about native button semantics on every render.
2. **Next.js Image optimizer flattens PNG transparency.** `next/image`'s built-in `/_next/image` route re-encoded `logo.png` and silently composited it onto white, even though the source file and even the exact optimizer output URL tested fine via direct `fetch()` + canvas pixel read. Fix: `<Image ... unoptimized />` for this asset. If you ever see a mystery white box behind a transparent PNG rendered via `next/image`, check this first.
3. **Next.js 16 renamed middleware to "proxy."** File must be `src/proxy.ts` (given this repo's `src/` layout), not `src/middleware.ts` or root `middleware.ts` — both are silently ignored. The build output confirms the right name: it prints `ƒ Proxy (Middleware)`, not `ƒ Middleware`.
4. **Testing controlled inputs with browser automation**: if you script-set a DOM input's value via the native value setter and it happens to equal a value already sitting in React's internal `_valueTracker` (e.g. from an earlier plain `.value =` write), React's synthetic `onChange` won't fire even though you used the "correct" trick. Reset to `''` first, dispatch, then set the real value, dispatch again.
5. **`aiProvider` must never be imported into a `"use client"` file.** The real provider needs `OPENROUTER_API_KEY` server-side; importing `src/lib/ai/index.ts` from a client component either leaks nothing (env var is `undefined` in the browser bundle) but silently always falls back to the mock, or — if someone "fixes" that by prefixing the key `NEXT_PUBLIC_`, it leaks a real secret into the browser. The fix already in place: client components call the `"use server"` wrappers in `src/lib/ai/actions.ts`, never `aiProvider` directly. Keep this boundary when you add student-side or candidate-evidence AI calls.
6. **`key={index}` on a mutable list is a real bug, not a lint nitpick.** The Challenge Builder's task list had this originally; fixed by adding a stable `id` field to `ChallengeTaskSchema` and generating it with `crypto.randomUUID()` at every construction site (mock provider, real provider, manual "add task" in the UI).
7. **`drizzle-kit` (the CLI) never reads `.env.local`.** That's a Next.js-only convention — `next dev`/`next build` load it automatically, but `npx drizzle-kit push`/`generate` do not, silently falling back to `drizzle.config.ts`'s placeholder connection string instead. Worse: the real error ("password authentication failed for user 'placeholder'") gets **swallowed** by a bug in drizzle-kit's own spinner/error-rendering code (`renderWithTask` in its bundled CLI calls `process.exit(1)` synchronously right after triggering an unflushed async render of the error, so the process dies before anything prints) — the only visible symptom is `drizzle-kit push` exiting instantly with no output at all, or (if something else already introspected an empty/wrong schema) a confusing downstream Zod error about a missing `version`/`dialect`/`tables`. **Fix, already applied**: `drizzle.config.ts` now does `import { config } from "dotenv"; config({ path: ".env.local" });` before `defineConfig(...)`. If `drizzle-kit push` ever goes silent again with zero output, suspect this exact swallowed-error pattern first — don't assume it's hanging or that the DB is unreachable.
8. **Supabase's direct DB host (`db.<ref>.supabase.co:5432`) can hang indefinitely** on networks that only resolve it over IPv6 (or where IPv6 routing to AWS is broken) — same silent-hang symptom as #7, easy to conflate with it. Fix: use the **pooler** connection string instead — `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres` (session mode, port 5432 — supports prepared statements, unlike the 6543 transaction-mode port which drizzle-kit needs session mode for). That's what `DATABASE_URL` is set to now.
9. **`drizzle-kit push` needs `schemaFilter: ["public"]` in `drizzle.config.ts` on a fresh Supabase project.** Without it, introspection walks every schema Supabase ships by default (`auth`, `storage`, `realtime`, `extensions`, `graphql`, `vault`, `pgsodium`, …), which is slow and not what you want diffed against your own `schema.ts` anyway. Already set.

## 9. Skills/tools used to build this (for context on how decisions got made)

- **`graphify`** — turned the full product spec (docs/00-10) into a queryable Obsidian vault (`vault/`) and knowledge graph (`graphify-out/`), used early on to make the spec navigable and to catch cross-doc inconsistencies (it flagged two genuinely ambiguous edges — Moat↔DataModel and PricingTiers↔MVPScope — which is how the QAR 499 "stubbed for v1" decision actually got resolved explicitly rather than left implicit).
- **Claude Code plan mode** — the phased build plan (Phase 1 mocked demo → Phase 2 real DB/auth/AI → Phase 3 student flow → Phase 4 candidate evidence → Phase 5 internship program → Phase 6 plumbing/polish) went through one full founder revision before approval; see section 6 above for what that revision actually mandated.
- **ecc skills actually run** (not just installed): `ecc:database-migrations` (informed the Drizzle schema conventions — uuid PKs, `defaultNow()` timestamps, nullable/defaulted columns), `ecc:react-review` (caught the `key={index}` bug), `ecc:security-scan` (AgentShield — note this only audits AI-agent config, not app code; the actual app security check was manual: grepped for `dangerouslySetInnerHTML`, `NEXT_PUBLIC_` secrets, `localStorage` token storage, `eval` — all clean), `ecc:accessibility` (caught 3 inline-edit fields with `focus-visible:ring-0` stripping keyboard focus indication — fixed), `ecc:test-coverage` (stood up Vitest from zero, wrote the 27-test suite).
- Chrome DevTools MCP (`mcp__plugin_ecc_chrome-devtools__*`) — used throughout to actually load pages, click through the wizard end-to-end, and inspect the DOM/network directly rather than trusting that generated code worked. This is how the Base UI `asChild`/`nativeButton` issue, the transparent-PNG issue, and the React-value-tracker testing gotcha were all actually found — every one of them looked fine in code review and only broke in the real browser.

## 10. Repo + Supabase (live)

- **GitHub**: `https://github.com/loaiahmedgit/internIn`, `main` branch. Pushed with `gh` (already authenticated as `loaiahmedgit`). No CI configured yet.
- **Supabase project**: name `internIn`, ref `qdlrrqjevcvjtkbsezaj`, org `loaiahmedgit's Org` (id `ytdssysxvwcqrwywlbno`), region `ap-south-1` (closest available option to Qatar in this Supabase CLI version — no `me-central1` choice existed at creation time). Dashboard: `https://supabase.com/dashboard/project/qdlrrqjevcvjtkbsezaj`.
- `.env.local` is filled in with real values (`DATABASE_URL` via the session pooler, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) — gitignored, never committed, confirmed via `git check-ignore`. The DB password is a random 32-char string generated with `openssl rand`; it only lives in `.env.local` and whoever's terminal scrollback captured the `supabase projects create` command.
- Schema is live: all 17 tables pushed via `npx drizzle-kit push --force` and verified by querying `information_schema.tables` directly. `npx drizzle-kit generate` after any future `schema.ts` change, then `npx drizzle-kit push --force` to apply it to this same project (no separate staging DB exists).
- Supabase CLI is authenticated on this machine via `npx supabase login --token <personal-access-token>` (stored in the CLI's local config, not in this repo). If it ever needs re-auth: generate a new token at `https://supabase.com/dashboard/account/tokens` (the one used to set this up should be considered exposed — it appeared in plaintext in a chat session — and is worth revoking and rotating).
- **Not done**: no Storage buckets created (needed for real CV/artifact file upload — currently submissions store artifact URLs, not uploaded files); no Row Level Security policies on any table (every authorization check currently happens in the Next.js server actions layer via `requireCurrentCompanyMember`/`requireCurrentStudent`, not in Postgres itself — fine since the DB is never accessed except through those server actions, but worth knowing if that assumption ever changes); Auth email confirmation still ON (see item 2 in section 6).

## 11. How to resume

```bash
cd /Users/loaiabouelezz/Desktop/internIn
npm install          # if node_modules is stale/missing
npm run dev           # http://localhost:3000
npm run build          # typecheck + full production build
npm test                # 27 tests, ~29s (real setTimeout delays in the mock provider)
npm run test:coverage    # coverage report
npx drizzle-kit generate  # regenerate migration after schema.ts changes
```

Env vars: `.env.local` already has real, live Supabase credentials filled in (see section 10 for the project ref/org — the actual secret values are only in `.env.local` itself, never in this file) — DB and Auth work out of the box on this machine. Only `OPENROUTER_API_KEY` is still unset (mock AI provider is active; set it and the real `GemmaProvider` swaps in automatically, no code change). On a different machine: either copy this `.env.local` over, or re-fetch the keys with `npx supabase projects api-keys --project-ref qdlrrqjevcvjtkbsezaj` (needs `npx supabase login` first) and rebuild `DATABASE_URL` from the pooler format in section 8's gotcha #8.

Read `docs/00-10` before changing product behavior. Read `design-system/internin/MASTER.md` before changing UI. Don't touch `logo.png`.
