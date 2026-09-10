# 13 — Honesty & Evidence Product Alignment

Read-only audit. No code, schema, or copy changed in this pass. This document
records the new master direction, what the shipped product already does that
agrees with it, where it conflicts, and the smallest correction sequence —
for owner review before any implementation begins.

---

## 1. New master product principles (as given)

- internIn is not an AI challenge generator, job simulator, AI hiring oracle,
  certificate platform, or CV replacement.
- internIn helps companies evaluate early-career candidates using **evidence
  of demonstrated work**, alongside — not instead of — CV/profile evidence.
  The model is `profile evidence + demonstrated evidence + human
  verification`.
- Every product claim must survive: *what do we actually know, what did the
  candidate actually demonstrate, what can actually be validated, what still
  needs human judgment, what can't be verified digitally, could external AI
  have affected this, are we claiming more than the evidence proves?* Where
  the answer exposes a limit, the product must show the limit.
- A "Challenge" is a realistic work-based assessment that produces a real
  artifact, evaluated by objective checks where possible and human judgment
  where not — never a disguised quiz.
- Company AI is a bounded assistant (challenge architect + evidence designer
  + review assistant), never an autonomous hirer, certifier, or standards
  inventor.
- A **company certificate/endorsement is only ever true after an explicit,
  distinct human grant action** — never a side effect of a policy setting
  chosen before the candidate existed.
- Companies eventually choose one of three application modes (Quick Apply /
  Quick Apply + Optional Challenge / Challenge Required), applied
  consistently across the eligible pool — not implemented yet, audit-only
  this pass.

### 1a. Three semantic clarifications (added mid-audit — govern everything below)

**Verified evidence ≠ verified skill.** "Verified" must never silently mean
"internIn verified the candidate generally possesses this skill." internIn
can only ever verify observable facts, deterministic checks, artifact
properties, test results, satisfied constraints, or evidence produced in the
assessed context. `"14/16 hidden tests passed"` is a valid verified claim;
`"React Native skill verified"` is not, unless the actual validation
mechanism and/or an authorized human review genuinely supports that stronger
statement. Three distinct concepts, never collapsed into one: **verified
evidence**, **demonstrated ability**, **human-endorsed ability**.

**Ability ≠ suitability.** A Challenge can provide evidence a candidate can
perform specific role-relevant work in the assessed context. It cannot
establish overall job suitability, culture fit, motivation, reliability over
time, real-world teamwork, physical execution, interpersonal behavior with
real people, or future performance. Every Challenge should eventually be
able to state both *what it can provide evidence for* and *what it cannot
establish*, explicitly.

**Updated honesty ladder** (replaces the flatter status-word list originally
given; used throughout this document instead of it):

| Level | Meaning |
|---|---|
| CLAIMED | The candidate/company says something is true. |
| OBSERVED | internIn directly observed an event or artifact. |
| VALIDATED | A defined check confirmed a specific factual condition. |
| DEMONSTRATED | Accumulated evidence supports an ability in the tested context. |
| HUMAN REVIEWED | An authorized person inspected the evidence. |
| HUMAN ENDORSED | An authorized company person explicitly chose to recognize that demonstrated ability. |
| NOT ASSESSED | The system did not test it. |
| NOT DIGITALLY VERIFIED | The system cannot responsibly establish it through this digital assessment. |
| UNKNOWN | Insufficient visibility/evidence to make any claim. |

**Internal mantra correction:** "PROOF over claims" → **"EVIDENCE over
unsupported claims."** Even strong Challenge evidence does not mathematically
prove future ability or future job success. Marketing may still say "Show
what you can do" / "Proof of what you can do" — product/data/evidence
semantics stay precise: evidence, demonstrated, observed, validated,
human-reviewed, human-endorsed, per what actually happened.

---

## 2. Area-by-area findings

Legend: **ALIGNED** / **PARTIALLY ALIGNED** / **CONFLICTS** / **MISSING**

### A. Internship creation — ALIGNED
Manual-first (`create-internship-form.tsx`), AI assist is optional and
field-scoped (`assistInternshipCopyAction`), never required to save or
publish. Hardened in Phase 5. No conflict with the new direction; no change
needed.

### B. Challenge creation — PARTIALLY ALIGNED
`buildEmployerContext` (`src/lib/ai/challenge-generation.ts`) extracts a
structured `EmployerContext` from an actual conversation, not a rigid form —
this already matches "start conversationally, extract structure, ask only
what's missing." The clarification engine (`clarification-engine.ts`) asks a
small, deterministic set of questions per profession (role domain, candidate
level, responsibilities, tools, work environment, access level,
restrictions, special context) built from `RoleProfile` data, never invented
per-call by the model.

**Gap:** the question set does not walk the ten-characteristic dimensions
(physical work, real humans, safety, equipment, legal authority,
unpredictability, confidential data, long horizon, team dependency,
consequences) and never asks *"what evidence would convince you they can do
the job?"* or *"how does your team actually use AI?"* explicitly. The
conversational architecture is the right foundation to extend — it does not
need to be rebuilt.

**Also:** "Start from scratch" (Phase 6B — a company-authored blank
template with placeholder text) exists as the manual fallback and is
unaffected by anything here.

### C. Challenge schema — PARTIALLY ALIGNED
`ChallengeSchema`/`ChallengeDraftGeneratedSchema` already require: `tasks`
(≥1), `materials` (with real generated file `contentSpec` — spreadsheet
columns, document sections, or a real external URL, never a placeholder),
`submissionRequirements` (real input modes: `file` / `multiple_files` /
`text` / `url` — **no multiple-choice/quiz mode exists anywhere in the
schema**), and a `rubric`. This is a strong existing match for
"artifact-first" and the MCQ rule.

**Gap:** no field anywhere classifies which abilities a challenge is
actually able to validate (digitally-assessable / human-review-required /
practical-verification-required / not-meaningfully-assessable) — i.e. no
schema representation of "what this Challenge can provide evidence for" vs
"what it cannot establish" (§1a). AI usage policy exists as a 5-value enum
(`not_allowed / research_only / allowed_with_disclosure / fully_allowed /
custom`) — more granular than the Allowed/Limited/Restricted the new
direction sketches, but conceptually the same "match company reality" idea;
no urgent change needed here, just possible relabeling later.

### D. Challenge generation AI — PARTIALLY ALIGNED, one confirmed MISSING safeguard
`CHALLENGE_POLICY` (`challenge-generation.ts:68`) already instructs: mix
real task types per profession, never one uniform quiz, use only synthetic
data for safety-sensitive professions, rubric criteria must be observable
and job-relevant. This is a genuinely good foundation.

**Confirmed missing:** nothing in `CHALLENGE_POLICY` or the clarification
flow detects and transforms an active-production-work request ("fix our
production bug," "build our client's campaign"). The *principle* has been
documented since `docs/05-anti-exploitation-rule.md` (day one), and the
policy text generally steers toward simulation, but there is no explicit
detect → respond-conceptually → offer-equivalent-assessment step. This is a
real, bounded gap directly named in the new direction's "No Free Labor"
section.

### D1. R3 — IMPLEMENTED (status update)

The bounded no-free-labor gap above is now closed without attempting the
broader R4 Challenge Architect redesign. Both Challenge-generation paths
produce structured `assessmentBasis`, potential `productionWorkRisk`, a
short factual reason, `transformationApplied`, and an original-intent
summary. The prompt requires live production/client/confidential-data work
to become an equivalent synthetic, fictional, adapted-historical,
anonymized-adapted, or sandbox assessment. A deterministic postcondition
rejects model output that reports a concern but leaves it untransformed.
This is a potential-concern classification, never model certainty.

The final safety boundary is not AI-dependent. Every new/edited immutable
Challenge version is safeguard policy version 2. Approval/publication
requires a selected non-production basis and a version-bound confirmation
from an authenticated authorized company user. The confirmation records the
actor and time and is cleared by content edits. `ensureChallengeReadyForPublish`
remains the single mode-aware publication guard, so R2 behavior does not
change: Quick Apply has no Challenge requirement; optional/required
Challenges both pass R3.

Estimated active work above 90 minutes requires a substantive exception
justification. More than 120 minutes is blocked. The current product has no
separate completion-window/deadline field, so R3 labels `estimatedMinutes`
as active work but deliberately does not invent or expand a deadline model.

Migration `0028_no_free_labor_safeguards.sql` is additive. Historical rows
remain policy version 1 with null safety/attestation metadata; existing
published Challenges stay published, and no past company confirmation is
fabricated. A future edited version must meet policy version 2.

### E. Challenge approval/publishing — ALIGNED (R3 strengthened)
`saveChallengeVersionAction`/`publishOpportunityAction`
(`opportunities/actions.ts`) are source-agnostic (`assertChallengeSubstance`
validates real content regardless of whether it came from AI or a human) and
require an explicit human approval step before publish. No AI auto-publish
path exists. R3 additionally requires the immutable approved version's
non-production basis, authenticated company confirmation, and active-work
duration compliance through the canonical shared publish gate.

### F. Student application modes — MISSING (mostly already possible structurally)
`applyToOpportunityAction` (`student-actions.ts:34`) is already a genuine
"quick apply" — it only ever creates an `applications` row (`status:
"applied"`), with no CV or challenge gate at apply time. Separately, an
opportunity can already be published with no challenge attached at all
(confirmed in Phase 5's audit: "No challenge included" is a real, honest
state, not a fake one). So **Quick Apply and Quick Apply + Optional
Challenge are already structurally possible today** — nothing technically
forces a challenge.

**What's actually missing:**
1. No explicit `applicationMode` field/label — a company can't declare
   intent, and a student can't see it.
2. **No fairness enforcement for "Challenge Required."** `shortlistApplicationAction`
   and offer creation never check whether a submission exists — a company
   could today shortlist or offer a candidate with zero challenge evidence
   even on an opportunity that "has" a challenge. The new direction's
   fairness rule (apply the requirement consistently across the eligible
   pool, never strong-CV-skips / weak-CV-forced) has no technical backstop
   at all right now.
3. The student-side challenge flow isn't framed as "optional bonus
   evidence" anywhere — it reads as the default path regardless of mode.

### F1. R2 — IMPLEMENTED (status update)

One canonical, opportunity-wide `application_mode` enum
(`opportunities.application_mode`, migration `0027`) with three real
product semantics — never per-candidate, never client-supplied at apply
time, never AI-set:

- **`quick_apply`** — student applies immediately; no Challenge exists for
  the opportunity; the company evaluates on profile evidence. May publish
  with no challenge at all.
- **`optional_challenge`** (the locked default for every NEW opportunity)
  — student applies immediately; completing the Challenge adds demonstrated
  evidence; **not** completing it is never an incomplete/invalid/warning
  state, never blocks shortlist or offer. Publishing this mode still
  requires a real approved Challenge (the mode advertises one).
- **`challenge_required`** — the application record is still created
  immediately, but the company **cannot shortlist or send an offer** until
  a valid final submission (`submissions` row) exists for that application.

**Fairness rule, enforced server-side:** the requirement is a property of
the *opportunity*, applied uniformly to its applicant flow. There is no
"strong CV skips the Challenge / weak CV must prove itself" path anywhere
— `assertChallengeRequirementMet` reads only the real opportunity row and
the submission's existence, never any candidate-specific signal.

**Where it's enforced (single shared checks, not per-button):**
- `assertChallengeRequirementMet` — called from `shortlistApplicationAction`
  and `inviteToInternshipAction`. Clears on a bare `submissions` row only;
  a started-but-not-submitted session never clears it, and **AI evidence
  evaluation is deliberately not required** (an OpenRouter/provider outage
  must never block hiring).
- `ensureChallengeReadyForPublish` — the shared publish-readiness gate used
  by **both** real publish entry points (`publishOpportunityAction`, from
  ChallengeBuilder; and `saveInternshipAction`'s `publish:true` path, from
  the manual form — these were independent, and the manual form's path had
  no challenge gate at all before R2). `quick_apply` skips it entirely.
- `updateApplicationModeAction` — the one canonical place to change mode
  after creation (a small settings panel on the opportunity page,
  `ApplicationModeSettings`, reused by every creation flow). Switching a
  published opportunity to optional/required is rejected unless a real
  approved Challenge already exists; switching to `quick_apply`, or editing
  a still-draft opportunity, is always safe and never deletes Challenge
  data. Historical shortlists/hires are never retroactively re-gated.

**Conservative production backfill (migration `0027`):** the read-only
pre-migration audit found 11 opportunities, all published, all with a
usable (approved/published) Challenge, zero applications on any
challenge-less opportunity — so all 11 mapped to `optional_challenge`
(most closely preserving current behavior). No opportunity is ever
backfilled to `challenge_required`.

**Student/company display (R2 §12):** hiring stage and Challenge state are
now two separate rows everywhere. `applicationStage` is pure hiring
pipeline; `challengeState` is a separate, mode-aware value that returns
`null` for `quick_apply` (no Challenge row at all) and renders
optional-not-attempted in a plain neutral badge — never the amber
"Challenge to complete" warning the old single blended stage used.

### G. Challenge student UX — ALIGNED (largely)
Real submission types, `SubmissionRequirementSchema.required` distinguishes
must-hand-in from optional, `challengeStartedAt` genuinely marks "work
begun." `estimatedMinutes`/`estimatedDurationLabel` (active work time) is
policy-enforced (`enforceChallengeDurationPolicy`, deterministic, caps
task/duration for non-explicit requests, honors an explicit employer-stated
duration).

**Gap:** no separate "completion window" concept exists —
`challengeStartedAt` is used only retroactively (for analytics timing), never
to communicate or enforce a "complete within 48 hours" style deadline
distinct from the "60 minutes of active work" estimate. The new direction
explicitly asks these be two separate, both-shown numbers.

### H. Submission artifacts — ALIGNED
`SUBMISSION_ARTIFACT_KINDS` covers pdf/spreadsheet/document/image/code/
code_repository/figma/presentation/video/audio/dataset/portfolio/
generic_link/text_response — real, differentiated artifact types matching
the archetypes the new direction lists (build/analyze/plan/communicate/
inspect/coordinate). No change needed.

### I. Evidence evaluation — PARTIALLY ALIGNED (real strength + real gap)
`evaluateCandidateEvidence` (`src/lib/company/evidence-evaluation.ts`) reads
real files/links/repos (extension allow-list, 5MB cap, 15s fetch timeout,
ownership-prefix checks), and `groundedHighlights`/`groundedMetrics`
(`evidence-summary.ts`) **verify every quote/claim actually exists in the
real source text before it's shown** — a genuine, already-shipped honesty
mechanism (an OBSERVED/VALIDATED-level guarantee per the §1a ladder), not a
gap. Unreadable/unsupported content becomes an honest `unavailable[]` entry
("requires human review — ..."), never silently skipped.

**Gap:** every rubric judgment (`aiProvider.evaluateAgainstRubric`) sits at
DEMONSTRATED at best — it is 100% AI-subjective, never VALIDATED by a
deterministic check. `EvidenceLevelSchema` is a good honesty signal on its
own (`strong / solid / developing / insufficient / not_demonstrated` — a
qualitative vocabulary, never a fake percentage), but "objective validation
first" as a real second, VALIDATED-level evaluation channel does not exist
yet.

### J. Objective validation — MISSING
No hidden-test framework, no deterministic formula/output checker, no
SLA/anomaly pattern-matcher exists anywhere in the codebase. This is
entirely future architecture, not a partially-built system — nothing in the
current pipeline can ever produce a VALIDATED-level claim, only DEMONSTRATED
or below. Confirmed via schema (`RubricCriterionSchema` has no
`checkType`/`validator` field) and evaluation code (single AI call, no
secondary deterministic pass).

### K. Rubric — ALIGNED, with an honest confidence signal already present
Rubric criteria are required to be observable/job-relevant at generation
time (`CHALLENGE_POLICY`). Evaluation output carries a real `confidence`
field (`low/medium/high`) that the eligibility engine already gates on
(`computeCredentialEligibility` requires `medium`/`high` before any
credential path opens — see §Q below). No fake certainty found in rubric
display.

### L. AI policy — ALIGNED
Real per-challenge field (`challenges.aiUsagePolicy` /
`challengeVersions.aiUsagePolicy`, `submissions.aiUsageMode`), same
`open/ai_allowed/restricted_ai/controlled` vocabulary on both the company
and student side so they're directly comparable. This is a real, working
mechanism already — just needs no urgent change.

### M. AI provenance — MISSING
`submissions.aiUsageMode` is **entirely self-declared (CLAIMED-level) by the
student** at submission time — the schema comment says so explicitly
(`schema.ts:611-613`). There is no OBSERVED-level record anywhere (no logged
prompts, draft generations, accepted/rejected suggestions, or diff between
AI output and final artifact). The product does not currently claim
external-AI detection anywhere in copy (a real, correct restraint — see the
honesty-language sweep, §Honesty-language) — but it also has zero
infrastructure to produce the "Observed AI usage" summary the new direction
describes for internIn's *own* future in-product AI assistant. Confirmed
genuinely greenfield, not a gap in an existing system.

### N. Similarity/integrity — MISSING
No similarity/plagiarism-comparison code exists anywhere in the repo (the
only "similarity" hit in the codebase is unrelated role-matching logic in
`role-intelligence.ts`). Entirely future architecture.

### O. Candidate evidence UI — ALIGNED
`ai-evidence-summary.tsx` is explicitly labeled "Assistive only," never uses
hire/reject/rank language (audited directly in Phase 5), and every claim
traces back to a real quote or an honest "requires human review" line.
Candidate comparison (`candidate-comparison-view.tsx`,
`gemma-provider.ts`'s compare prompt) explicitly forbids ranking language —
confirmed in Phase 5. Directly re-checked this pass for any
suitability-collapsing language per §1a (a suitability score, an overall
candidate score, "best candidate," an AI recommendation, or ranking
language that folds evidence into total suitability) — **none found**. This
is one of the strongest-aligned surfaces in the product already, and
already respects the ability ≠ suitability distinction in practice even
without it being written down anywhere yet.

### P. Review workflow — PARTIALLY ALIGNED
Candidates list/detail surfaces real evidence with no fake scoring (Phase 5
audit). All consequential actions (shortlist, send offer, reject) remain
explicit human clicks — no AI auto-execution anywhere. Notes are
company-private, correctly RLS-scoped away from students (verified in
Phase 4C/5).

**Gap:** no formal "review speed" design exists yet — no compact
requirements-passed / objective-checks / similarity-signal summary built
specifically for a 30-90-second first pass. The building blocks (grounded
evidence, `confidence`, `unavailable[]`) already exist; they're just not
yet composed into that fast-scan layout.

### Q. Credential / company endorsement — **CONFIRMED CONFLICT (the critical one)**
Two exact code paths currently let `companyEndorsed` become `true` with
**zero explicit, distinct human grant action** — i.e. the product currently
jumps straight to HUMAN ENDORSED (or even skips past HUMAN REVIEWED
entirely) without the ladder's own required step ever actually happening:

1. **`src/lib/credentials/issuance.ts:66-67`** — `issueCredentialForSubmission`.
   When a challenge's `credentialPolicy === "company_endorsed"` and
   `requireHumanConfirmation` is `false`, eligibility resolves straight to
   `"issued"` and `companyEndorsed` is set `true` in the same insert, with
   **no human touchpoint of any kind** for that specific candidate. This
   path never even reaches HUMAN REVIEWED, let alone HUMAN ENDORSED.
2. **`src/lib/credentials/confirmation.ts:42-43`** — `confirmPendingCredential`.
   When `requireHumanConfirmation` is `true`, the reviewer's ONE click
   ("Confirm credential" — dialog copy: *"This issues the credential. It
   does not affect this candidate's application status or hiring
   decision."*, no mention of endorsement at all) **also** silently sets
   `companyEndorsed = true` as a side effect, whenever the challenge's
   policy happens to be `company_endorsed`. The reviewer reaches HUMAN
   REVIEWED but the product then claims HUMAN ENDORSED anyway — the
   reviewer is never asked a separate "does your company endorse this"
   question, and the dialog text doesn't disclose that endorsement is
   bundled into that click.

The root cause is architectural: `credentialPolicy` is a **challenge-level
setting chosen at challenge-creation time**, before any candidate exists —
company-facing copy for that setting literally says *"Qualifying credentials
also carry your company's endorsement"* (`challenge-credential-settings.tsx:12`),
which is an accurate description of the current (non-compliant) behavior.
The new direction requires endorsement to be a **per-candidate, post-evidence,
explicit act** — a pre-decided policy can authorize the *option* to endorse,
but must never itself grant it.

**Downstream effect:** the public `/verify/[code]` page and the generated
PDF both then state, permanently and publicly, *"[Company] has endorsed this
credential"* (`app/verify/[code]/page.tsx:54`, `credential-pdf.tsx:59-62`)
for a candidate no human at that company ever explicitly reviewed and
endorsed. This is the single highest-priority correction in this whole
audit — a live, real product-honesty defect, not a hypothetical one.

**Naming check — "internIn Verified Challenge Credential" (§1a, requested
explicitly):** the product-facing term is "Verified," not "[Skill] Verified"
or "Skill Verified" — it never attaches a specific skill name directly to
the word "Verified" in isolation (e.g. it does not say "React Native
Verified"). Copy around it ("evidence supports issuing a Verified Challenge
Credential," demonstrated-criteria lists shown before confirmation) already
leans toward the DEMONSTRATED framing rather than claiming universal skill
possession. That said, a reasonable outside reader (student, employer,
investor) encountering the phrase "Verified Challenge Credential" in
isolation — on a LinkedIn post, a CV line, or the PDF's own bold heading —
could still reasonably read "Verified" as "internIn verified this person is
good at X," not the narrower "internIn verified specific evidence was
produced in one assessed context." The name is not overtly false, but it is
optimized for confidence over precision, and it sits closer to the "RISKY"
example in §1a (*"React Native skill verified"*) than the "VALID" one
(*"14/16 hidden tests passed"*) whenever it's read without its surrounding
context (i.e. on the PDF or a public share, away from the fuller in-app
explanation). **Not renamed this pass, per instruction.** Whether it should
change later, and to what, is an owner decision (§17) — possible safer
directions if changed: lead with "Evidence" rather than "Verified" (e.g.
"internIn Verified Evidence" or "Verified Challenge Evidence"), or keep
"Verified" but always pair it with the specific demonstrated criteria
inline wherever the credential is shown standalone (PDF, public verify page,
share text) rather than only inside the full app experience.

**Not touched this pass**, per instruction — see §14 for the smallest
proposed fix.

### Q1. R1 — IMPLEMENTED (status update)

Both automatic-endorsement paths above are fixed. `companyEndorsed` can now
become `true` in exactly one place: `grantCredentialCompanyEndorsement`
(`src/lib/credentials/company-endorsement.ts`), called only from the
explicit `grantCredentialCompanyEndorsementAction` server action, itself
gated on a real, per-opportunity `certificate_approver` responsibility
assignment (`src/lib/opportunities/responsibility-assignments.ts`,
`opportunity_responsibility_assignments` table) **plus** real company-level
permission — neither alone is sufficient, and there is no `workspace_admin`
bypass on this specific gate.

Corrected semantic ladder, as actually implemented:

`OBSERVED` (raw submission) → `VALIDATED` (deterministic checks) →
`DEMONSTRATED` (AI-evaluated rubric criteria at `strong`/`solid`) →
`HUMAN REVIEWED` (a reviewer confirms the base evidence credential may be
issued — `confirmChallengeCredentialAction`, never implies endorsement) →
`COMPANY ENDORSED` (a distinct, later, optional act — an authorized
certificate approver explicitly selects a subset of the credential's own
demonstrated criteria and grants — `grantCredentialCompanyEndorsementAction`).
A credential can sit at any of the first four rungs indefinitely; it reaches
the fifth only through that one explicit action, and reaching it never
requires passing back through issuance or confirmation again.

`companyEndorsedCapabilities` (a server-validated subset of the credential's
own frozen `rubricSnapshot`, never arbitrary reviewer-typed text) is the
durable record of exactly what was endorsed. Withdrawal
(`withdrawCredentialEndorsementAction`) uses the identical double-gate as
granting, never touches the base credential's own `status`, and records
who/when/why internally (`endorsementWithdrawnByUserId`,
`endorsementWithdrawnAt`, `endorsementWithdrawalReason`) without erasing the
historical grant event from `event_log`.

Public/student-facing surfaces (`/verify/[code]`, the credential PDF, the
student credential detail page, the company review panel) now render
evidence-credential status (Valid/Revoked) and company-endorsement status
(Not granted/Granted/Withdrawn) as two separate, clearly labeled elements —
never one blurred "Verified" badge — and, once granted, show the specific
endorsed capabilities rather than a blanket claim. Copy was updated toward
"internIn Challenge Evidence Credential" on touched surfaces; the underlying
DB identifiers (`credential_policy_enum` values, table names) were
deliberately left unchanged per the smallest-safe-migration decision in §2
below.

A read-only production audit (per §3 of the original R1 instruction) run
before this migration found **zero existing rows** with
`company_endorsed = true` — there was no historical data requiring owner
review before the fix could ship.

See the commit this shipped in for the full file list and the exact
migration (`0026_company_endorsement_honesty_fix.sql`).

### R. Company permissions/assignments — PARTIALLY ALIGNED
One company portal, one permission model (`workspace_admin / hiring_access /
hiring_reviewer / program_supervisor` — `permissions.ts`), no
HR-vs-Supervisor identity question anywhere in onboarding. This already
matches "one portal, permissions not job titles."

**Gap:** `hiring_reviewer` is a **company-wide** grant — it authorizes
reviewing every candidate across every opportunity, not a specific
challenge or internship. There is no per-challenge "Reviewer" or
"Certificate Approver" assignment analogous to Phase 6A's
`programSupervisorAssignments` (which is explicitly post-hire and must not
be reused for this — confirmed separate concern, correctly kept apart).
For a small company this coarse grant may be an acceptable v1 simplification;
for the certificate-approval gate specifically (§Q's fix), *some* explicit
"who is allowed to grant a certificate" concept will be needed — worth
deciding whether that reuses `hiring_access`/`hiring_reviewer` as-is or
needs a new narrow assignment type.

### S. Current post-hire routes/features — ALIGNED with the freeze instruction
`internshipPrograms/internshipWeeks/internshipTasks/supervisorFeedback/
verifiedExperience/programSupervisorAssignments` and the full Phase 6B
student workspace (`/student/internships/[programId]`, task blocker/evidence
fields, student-edit guard trigger, completed-program read-only behavior)
all remain exactly as shipped in commit `96951c2`. Nothing here conflicts
with the new direction — it is out of scope, not wrong, and is not touched
by this audit or any part of the proposed sequence below.

---

## 3. Current technical capabilities (concrete inventory)

**Real, working, keep as-is:**
- Manual-first internship + challenge creation (Phase 5).
- Conversational employer-context extraction + deterministic clarification
  question engine, profession-aware via `RoleProfile`.
- Real artifact generation (spreadsheets with real columns/rows, documents
  with real sections, or a real external URL) — never placeholder files.
- Quote-grounded evidence summaries (`groundedHighlights`/`groundedMetrics`)
  — a genuine, already-shipped OBSERVED/VALIDATED-level anti-hallucination
  mechanism.
- Qualitative (not numeric) rubric evidence levels, with a real `confidence`
  gate before any credential path opens.
- Deterministic challenge-duration policy enforcement.
- No hire/reject/rank/score/suitability language anywhere in AI-facing copy
  (verified directly — see §Honesty-language).
- Source-agnostic publish validation (human or AI origin treated identically).
- One company portal, permission-based (not identity-based) access.

## 4. Current evidence limitations (concrete inventory)

- Evaluation tops out at DEMONSTRATED; zero deterministic/objective (VALIDATED)
  checks exist.
- No AI-provenance observability — `aiUsageMode` is CLAIMED (self-declared)
  only, never OBSERVED.
- No similarity/integrity infrastructure at all.
- Live provider execution of the new R3 generation safeguard remains
  unverified because the configured OpenRouter account has no credits; the
  structured schema, prompt, deterministic postcondition, mapping, manual
  path, and publish gates are covered by deterministic tests.
- No completion-window (vs. active-work-time) concept.
- No ten-characteristic classification anywhere in schema or generation —
  no structured "what this Challenge can provide evidence for / cannot
  establish" statement exists yet (§1a).
- `company_endorsed` is not gated by an explicit per-candidate HUMAN
  ENDORSED action (§2.Q — the critical finding).
- The credential's own name ("Verified Challenge Credential") leans toward
  implying more than DEMONSTRATED when read out of context (§2.Q naming
  check).

## 5. Credential/certificate semantic correction — see §2.Q above (full detail there)

## 6. What this Challenge can/cannot establish — new gap identified via §1a
No mechanism today produces the "can provide evidence for / cannot
establish" statement the clarifications ask every Challenge to eventually
support. This is the natural companion output to the ten-characteristic
classification (§8) — same generation step, two ways of presenting the same
underlying analysis: one machine-readable (per-ability classification), one
human-readable (a short two-column summary shown to both the employer before
publish and the candidate before starting). Not built; smallest integration
point noted in §8.

## 7. Application-mode design impact
Smallest schema shape (not implemented, for owner review):
- `opportunities.applicationMode`: new enum `quick_apply | optional_challenge
  | challenge_required`, default `optional_challenge` (closest to current de
  facto behavior — a challenge can exist and nothing blocks applying without
  it).
- Enforcement point: `shortlistApplicationAction`/offer-creation gain a
  check — when `applicationMode === "challenge_required"` and no submission
  exists, block with a clear message. This is the one real technical lever
  needed for the fairness rule.
- UI: student-side framing changes only for `optional_challenge` ("Complete
  the Challenge to add demonstrated evidence") vs `challenge_required`
  ("Required to be considered").
- No change needed to `ChallengeSchema`/`assertChallengeSubstance` — an
  opportunity with no challenge at all already works today.

## 8. Company-AI redesign impact + ten-characteristic-framework integration
The conversational extraction + deterministic clarification engine already
matches the desired shape. Smallest addition: extend the clarification slot
vocabulary (`ClarificationSlotSchema`, `role-profiles.ts`) with the missing
dimensions the ten-characteristic framework needs, and add one new
pre-generation step — "Here's what I understood," including the
digitally-assessable/human-review/practical-verification/not-assessable
classification and the plain-language can-provide-evidence-for /
cannot-establish summary (§6) — before the employer confirms generation. No
rebuild of the conversation architecture itself. Cleanest data shape: a new,
small structured output (`RoleCharacteristicAnalysisSchema` or similar)
produced once per role during the employer-context step, feeding both (a)
clarification question selection and (b) the challenge's own summary shown
to employer and candidate. Additive — does not require touching
`ChallengeSchema`'s existing required fields.

## 9. Objective-validation architecture gap
Genuinely new subsystem — the only pipeline component that can produce a
VALIDATED-level (not just DEMONSTRATED) claim. Smallest v1 shape: an
optional, profession-agnostic `objectiveChecks` array on a challenge version
(deterministic expected-value/pattern checks authored by the Challenge AI
alongside the rubric, run server-side against the real submitted artifact
before the AI subjective pass). Out of scope to design in detail here —
flagged as its own implementation phase (§14).

## 10. AI provenance architecture gap
Only relevant once internIn's own in-product AI assistance for candidates
exists (it largely doesn't yet, beyond challenge generation for companies).
No schema work needed until that assistant exists — correctly deferred.

## 11. Similarity/integrity architecture gap
Same — genuinely new subsystem, no existing code to build on. Deferred.

## 12. No-free-labor safeguards — R3 IMPLEMENTED

R3 uses the current Challenge/version architecture rather than a prompt-only
patch. Structured AI concern/transformation metadata improves generation;
deterministic version state protects manual and AI paths equally; authorized
human confirmation anchors accountability; and 90/120-minute active-work
rules address excessive scope. Existing published Challenges remain honest
pre-R3 records rather than receiving fabricated attestations. This bounded
phase does not include R4's role-reality/ten-characteristic/can-cannot-
establish framework.

## 13. Review-speed requirement
Building blocks already exist (grounded evidence, `confidence`,
`unavailable[]`, real requirement pass/fail per submission requirement).
Needs composition into a fast-scan summary layout — a UI-layer change, no
new data model required.

## 14. Recommended implementation phases (proposed, not started)

Based on actual repo dependencies, not the illustrative labels in the
request:

**R1 — Credential/endorsement correction (§2.Q).** Highest priority: it's a
live, public-facing honesty defect, not a hypothetical one. Smallest fix:
split "confirm base credential" (→ HUMAN REVIEWED) from "grant company
endorsement" (→ HUMAN ENDORSED) into two distinct actions/UI moments;
`companyEndorsed` never gets set anywhere except the new explicit grant
action. Needs a decision on the certificate-approver permission question
(§2.R) first — otherwise this phase has no sensible "who can grant" answer.
Naming (§2.Q naming check) can be addressed in the same phase or deferred
separately — owner's call (§17).

**R2 — Application modes (§7).** One enum column + one enforcement check +
minor UI framing. Low schema risk, directly closes the fairness gap.

**R3 — No-free-labor safeguards (§12) — COMPLETE.** Additive immutable-version
metadata, manual company confirmation, structured AI transformation output,
canonical publish enforcement, and active-work duration limits.

**R4 — Ten-characteristic framework + Company-AI conversation extension +
can/cannot-establish summary (§6, §8).** Builds on the existing
conversational engine; the largest AI-prompt-design effort in this list but
the least architecturally risky (additive schema, existing pipeline).

**R5 — Review-speed evidence-summary UI (§13).** Pure UI composition of
already-real data — can happen any time after R1, independently of the
others.

**R6 — Objective validation (§9).** New subsystem; depends conceptually on
R4's characteristic classification (which abilities are even
digitally-checkable) to be well-targeted rather than generic.

**R7 — AI provenance (§10) and R8 — Similarity/integrity (§11).** Both
depend on features (in-product candidate-facing AI assistance; multi-
candidate comparison at scale) that don't fully exist yet — correctly last.

## 15. Migration risks
- R1 is data-shape-neutral if implemented as a new action + a stricter
  invariant on writes to `companyEndorsed` (no column change required,
  just removing the two silent-set code paths and replacing them with one
  explicit action). Real risk is entirely in decision-making (§17), not
  migration mechanics.
- R2's new enum column is purely additive; default value choice matters for
  existing published opportunities (recommend `optional_challenge` as the
  default backfill — matches current de facto behavior exactly, changes
  nothing for existing listings).
- R3 uses additive migration `0028`; historical rows remain policy version 1
  with null R3 attestations and are not unpublished or destructively backfilled.
- R4 is additive-only if scoped as new nullable fields/tables.
- R6-R8 are new subsystems — no migration risk to existing data, only new
  tables.

## 16. What remains frozen post-hire
Per explicit instruction: Supervisor Workspace, attendance,
location/geofencing, further task-management features, employee
collaboration, Student Agent, Supervisor Agent, post-hire analytics. Phase
6B stays exactly as shipped — foundation for later, not touched by anything
in this document.

## 17. Owner decisions still required
1. **§2.Q/R1:** who is authorized to grant a company certificate — reuse
   `hiring_access`/`hiring_reviewer` as-is, or introduce a narrow new
   "Certificate Approver" assignment (per-challenge or per-opportunity,
   mirroring `programSupervisorAssignments`'s shape)?
2. **§2.Q:** should certificate content let the reviewer select *which*
   demonstrated abilities to recognize (per the new direction's example), or
   is "grant/don't grant" as a single yes/no sufficient for v1?
3. **§2.Q naming check:** does "internIn Verified Challenge Credential" need
   to change (e.g. toward an "evidence"-led name), or is pairing it with
   explicit demonstrated-criteria text everywhere it appears standalone
   (PDF, public verify page, share text) sufficient correction on its own?
4. **§7:** confirm `optional_challenge` as the correct default
   `applicationMode` for all existing published opportunities on migration.
5. **§7:** exact enforcement point for `challenge_required` — hard-block
   `shortlistApplicationAction`/offer creation server-side (recommended), or
   only a soft warning to the reviewer?
6. **§8:** how much of the ten-characteristic output should the employer
   see before generation (full "Here's what I understood" summary, as the
   new direction describes) versus only baked silently into rubric/artifact
   design?
7. **Sequencing:** confirm R1→R2→R3→R4→R5→R6→R7→R8 (§14), or reprioritize —
   in particular, confirm R1 (credential correction) should proceed before
   any application-mode work, since it's the more urgent honesty defect.

---

## Honesty-language sweep (production-facing copy)

Searched company/student-facing UI and generated-copy templates for:
`verified, proved, objective, AI detected, AI generated, suitable,
recommended, top candidate, score, skill verified, company endorsed,
certificate`, plus a second pass specifically for suitability-collapsing
language per §1a (`suitability score, overall candidate score, best
candidate, AI recommendation, ranking language`).

- **No overclaiming hiring-decision or suitability-collapsing language found
  anywhere**: no "top candidate," "best candidate," "suitable candidate,"
  "recommended employee," "overall score," fake acceptance-probability
  percentages, or claimed AI detection of external tool use. This was
  independently confirmed in the Phase 5 audit and reconfirmed here under
  the stricter §1a lens — a genuine strength, not a gap.
- **"Company Endorsed" / "endorsed"** appears in `challenge-credential-
  settings.tsx`, `credential-pdf.tsx`, and `/verify/[code]/page.tsx` — all
  three are the exact locations implicated in the §2.Q conflict. Not
  rewritten this pass (instructed not to fix yet), but flagged as the
  copy that will need to change alongside the code fix in R1.
- **"Verified"** (as in "internIn Verified") is used consistently in-app to
  mean "evidence was demonstrated in the assessed context per internIn's
  process" — matches DEMONSTRATED on the §1a ladder wherever it's shown
  with its surrounding context. See §2.Q's naming check for the one place
  (the standalone credential name, read out of context) where "Verified"
  alone risks reading as more than the ladder actually supports.
- No instances of "score" as a candidate-facing number were found — rubric
  results are qualitative labels, not percentages, everywhere checked.
