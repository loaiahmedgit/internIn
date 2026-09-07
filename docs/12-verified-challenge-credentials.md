# Verified Challenge Credential — Architecture

Product/data/security/UX architecture for Phase 4. **This is a design document, not a build spec executed yet.** No migration, no code, until this is reviewed and approved. Inspected the real schema (`src/db/schema.ts`), the real evidence pipeline (`src/lib/company/evidence-evaluation.ts`, `evidence-summary.ts`, `src/lib/ai/schemas.ts`), the real PDF stack (`src/lib/pdf/documents/challenge-document-pdf.tsx`, pdfcn/Takumi), and the real RLS pattern (`0018_challenge_resources_rls.sql`) before proposing anything below — every table/column/policy referenced by name is real, not assumed.

## Problem

Challenges ask students for 60–90 minutes of real work. If the only outcome is "hired" or "nothing," the risk/reward is worse than a CV-based Easy Apply, and that kills adoption. The submitted work must create value that survives rejection — durable, portable proof the student demonstrated something real, independent of whether any specific company hired them.

## Product principles (non-negotiable, checked against every design choice below)

1. **Completed ≠ credentialed.** Submitting a valid challenge and earning a Verified Challenge Credential are different facts, stored differently, never conflated in UI copy.
2. **No magic score gate.** Eligibility is a deterministic, policy-driven rule over grounded evidence (existing `candidateEvidence.evidenceSummary` shape) — not `score >= 80`. Section 6.
3. **internIn is the default issuer; company endorsement is opt-in.** A credential works, and reads as legitimate, with zero company action beyond having credential issuance enabled. "Company X certifies this student is skilled" only appears when Company X explicitly turned on endorsement for that challenge.
4. **Credential survives rejection.** Nothing about issuance reads `applications.status` or `internship_offers.status`. A `declined` application and an `issued` credential are both valid, simultaneous facts.
5. **Immutable snapshot.** What a viewer sees on `/verify/[code]` never silently changes because a company edited a rubric or renamed itself later.
6. **Revoked, not deleted.** A revoked credential stays checkable and says "Revoked" — so a screenshot of a since-revoked credential can't be passed off as currently valid.

---

## 1–3. Data model, snapshot principle, status model (combined — they're one design)

### What already exists and is reused, not duplicated

| Concept | Existing table/field | Role in credentials |
|---|---|---|
| The work itself | `submissions`, `submission_artifacts` | Source of truth for what was submitted — never copied wholesale into the credential |
| The rubric that graded it | `challenge_versions.rubric` (pinned via `submissions.challengeVersionId`, `restrict` delete) | Same pinning pattern reused for the credential's own `challengeVersionId` FK |
| The evaluation | `candidate_evidence.evidenceSummary` (`RubricMetric[]`: `criterion`, `level: strong|solid|developing|insufficient|not_demonstrated`, `rationale`, `evidenceQuote`) + `confidence: low|medium|high` | **This is already the exact "demonstrated criteria, not a percentage" model the product spec asks for.** No new evaluation output shape needed — the credential's eligibility service and its public-facing "Demonstrated" list both read `RubricMetric.level` directly. |
| Company identity | `companies.name`, `companies.logoUrl` | Snapshotted at issuance (principle 5), never live-joined for display |
| Audit trail | `event_log` (`entity_type`, `entity_id`, `event_type`, `actor_user_id`, `metadata`) | Reused as-is for every credential lifecycle event — no separate credential audit table |

### New table: `challenge_credentials`

One row = one **issued** credential. Critically: **no row is created for `not_eligible` / `pending_evaluation` / `eligible`** — those are derived, read-time states computed from `submissions` + `candidate_evidence` + the policy (Section 3 below explains why). A row exists starting at `pending_human_confirmation`, or starting at `issued` when no confirmation is required.

```
challenge_credentials
  id                        uuid pk
  student_id                uuid  -> users.id            (cascade — a deleted user's credentials go with them, same as every other student-owned row)
  application_id            uuid  -> applications.id     (restrict — applications aren't deleted today; restrict is the honest default, matches submissions/challenge_versions convention)
  submission_id             uuid  -> submissions.id       (restrict, one column, NOT globally unique — see reissue rules §23; a partial unique index enforces "one non-revoked credential per submission")
  challenge_version_id      uuid  -> challenge_versions.id (restrict — pins exact rubric content, same pattern as submissions.challengeVersionId)
  company_id                uuid  -> companies.id         (restrict)
  status                    credential_status enum: 'pending_human_confirmation' | 'issued' | 'revoked'
  company_endorsed          boolean not null default false   -- LIVE fact, see correction note below
  company_endorsed_at       timestamptz
  endorsement_withdrawn_at  timestamptz
  endorsement_withdrawal_reason text
  policy_snapshot           jsonb  -- {policy: 'internin_verified'|'company_endorsed', requireHumanConfirmation, showCompanyLogo} frozen at issuance
  display_title             text not null       -- challenge title, snapshotted
  company_display_name      text not null       -- company name, snapshotted
  skills_snapshot           jsonb string[] not null
  rubric_snapshot           jsonb  -- [{criterion: string, level: EvidenceLevel}]  — level only, NOT rationale/evidenceQuote (those stay private in candidate_evidence, never copied into a row a public page can read)
  completed_at              timestamptz not null  -- submissions.submittedAt, snapshotted
  verification_code         text not null unique   -- e.g. INTERNIN-CH-7F4K2P, see §11
  is_publicly_shared        boolean not null default false   -- student-controlled, see §21
  publicly_shared_at        timestamptz
  issued_at                 timestamptz
  revoked_at                timestamptz
  revocation_reason_internal text          -- never shown publicly
  revocation_reason_public   text          -- optional, short, shown on the public page only if set
  metadata                  jsonb not null default {}
  created_at / updated_at
```

**Correction to this doc, applied at Phase 4A implementation time (product-owner decision #2/#4):** the schema above originally froze company endorsement only inside the immutable `policy_snapshot`, with no live toggle. That doesn't support the locked requirement that "a company may withdraw its endorsement" without touching the base credential. `company_endorsed`/`company_endorsed_at`/`endorsement_withdrawn_at`/`endorsement_withdrawal_reason` are now **live, mutable columns** — `company_endorsed` starts `true` at issuance when the governing policy was `company_endorsed`, and a company can flip it back to `false` via a distinct action (`withdrawCredentialEndorsement`) that never touches `status`/`revoked_at`. `policy_snapshot` is unchanged in meaning: it stays the immutable historical record of what governed issuance, and can legitimately disagree with `company_endorsed` afterward (e.g. issued under `company_endorsed`, later withdrawn — `policy_snapshot.policy` still says `company_endorsed`, `company_endorsed` is now `false`). Base-credential revocation (`status → revoked`) and endorsement withdrawal are two independent actions with two independent authorization boundaries (§15) — this was the doc's original intent throughout §4/§12/§15/§20/§26, this is only a schema-level correction to actually support it, not a change in product semantics.

Indexes: `student_id`, `application_id`, unique `verification_code`, and a **partial unique index** `(submission_id) WHERE revoked_at IS NULL` — the mechanism behind §23's "one canonical active credential per submission."

Why no row for pre-issuance states: `candidate_evidence` already only gets created once evaluation actually runs (mirrors this exact "don't materialize a row for a state that hasn't happened yet" convention already in this codebase). Persisting `not_eligible`/`pending_evaluation`/`eligible` would mean either a background job keeps that row in sync with live evaluation re-runs (drift risk) or it goes stale the moment a company re-triggers evaluation. Deriving it at read time from `submissions` + `candidate_evidence.evidenceSummary` + the challenge's policy is one function, always correct, and it's exactly what the "student sees after challenge completion" UI (§18) needs to poll anyway.

### New columns on `challenges` (the credential policy)

```
challenges.credential_policy            credential_policy enum: 'off' | 'internin_verified' | 'company_endorsed'   default 'internin_verified'  -- see open question in §30
challenges.require_human_confirmation   boolean not null default false
challenges.show_company_logo            boolean not null default false   -- only meaningful when credential_policy = 'company_endorsed'
challenges.required_integrity_mode      text nullable   -- reserved for future Integrity Engine (Phase 8); always null today, never enforced until that phase ships
```

Policy lives on `challenges`, not `opportunities` or a new join table. Reasoning: `challenges` already has `status` as its own lifecycle field (draft → published, etc.), it's 1:1 with `opportunities`, and rubric content already lives one level down in `challenge_versions` — putting policy at the same level as the thing it governs avoids an override-resolution table. **Not** put on `challenge_versions`: policy is operational config a company should be able to flip without minting a new immutable version.

### New columns on `companies` (creation-time defaults only, not live-inherited)

```
companies.default_credential_policy              credential_policy enum, default 'internin_verified'
companies.default_require_human_confirmation      boolean not null default false
```

These are copied onto a new `challenges` row at creation time (a plain default-value pre-fill in the Challenge Settings UI), never referenced live at eligibility-check time. This deliberately avoids "does this challenge inherit the company default or override it" resolution logic — YAGNI until a company actually asks for org-wide policy changes to retroactively apply, which is a real but separate feature if it ever comes up.

### Immutable snapshot — why these specific fields and not others

Copied at issuance: `display_title`, `company_display_name`, `skills_snapshot`, `rubric_snapshot` (level only), `completed_at`, `policy_snapshot`. **Not** copied: the full rubric criterion *descriptions*, the AI rationale text, evidence quotes, artifact contents. Those stay behind `candidate_evidence`/`submission_artifacts`' existing private-storage/RLS boundary — a credential is a factual claim ("demonstrated Customer reasoning"), not a leak of the underlying private submission or the company's internal grading commentary. If a company edits its name, deletes the opportunity, or rewrites the rubric next month, every already-issued credential's public page is unaffected — it reads its own snapshot columns, never re-joins live `companies`/`challenge_versions` rows for display text. The FK to `challenge_version_id` is kept for audit/investigation tooling only, never for rendering.

---

## 4. Eligibility state machine (derived pre-issuance, persisted post-issuance)

```
                    ┌─────────────────┐
  no submission ──▶ │  not_eligible    │
                    └─────────────────┘
                            │ submission exists, no candidate_evidence row yet
                            ▼
                    ┌─────────────────┐
                    │ pending_evaluation│
                    └─────────────────┘
                            │ candidate_evidence.evidenceSummary populated
                            ▼
                 ┌─────────────────────────┐
                 │ eligibility rule evaluated│ ── fails ──▶ not_eligible (evidence too weak — stays here permanently for this evaluation; a company re-running evaluation can move it forward again)
                 └─────────────────────────┘
                            │ passes
              ┌─────────────┴─────────────┐
   requireHumanConfirmation=false   requireHumanConfirmation=true
              │                             │
              ▼                             ▼
   ┌─────────────────┐          ┌───────────────────────────┐
   │ issued (row created) │◀────│ pending_human_confirmation │ (row created here)
   └─────────────────┘  confirm └───────────────────────────┘
              │                             │ reviewer declines
              ▼                             ▼
        ┌───────────┐               back to not_eligible (no row persisted for the decline — a declined confirmation is logged in event_log, not stored as its own credential state)
        │  revoked   │  (terminal for this row; §23 covers reissue)
        └───────────┘
```

`credential_policy = 'off'` short-circuits everything to `not_eligible`, always, regardless of evidence — no UI ever suggests a credential is possible for that challenge.

---

## 5. Company credential policy — UX

**Placement: Challenge Settings** (where the rubric, submission requirements, and AI usage policy already live in the challenge builder), with **Company Settings** holding only the two default columns above as a pre-fill, not a live control surface a reviewer has to separately go find. This matches the instruction not to scatter credential controls across multiple screens — everything that actually takes effect lives in one place, next to the rubric it governs.

Company-facing copy (not engineer-facing):

- **Toggle:** "Award a Verified Challenge Credential to qualifying candidates" (on/off — maps to `off` vs. everything else)
- **When on, one more toggle:** "Allow this credential to show [Company name] as an endorsing company" (off = `internin_verified`, on = `company_endorsed`)
- **When endorsement is on:** a logo-display checkbox ("Show our logo on the credential")
- **One more toggle, independent of the above:** "Require a reviewer to confirm before a credential is issued" (`require_human_confirmation`)

No numeric threshold, no rubric-weight exposure, no "confidence level minimum" dropdown in this UI — the eligibility rule (§6) is internIn's own deterministic policy, not something HR configures per challenge. That is deliberately kept out of company hands to avoid a support burden and to avoid every company inventing its own bar.

---

## 6. Eligibility logic

Reads only `submissions`, `candidate_evidence.evidenceSummary` (real `RubricMetric[]` + `confidence`), and the challenge's policy columns. No new AI call, no new evaluation pipeline — eligibility is a pure function over evaluation output that already exists.

```
function computeEligibility(submission, evidenceSummary, policy):
  if policy.credentialPolicy == 'off': return NOT_ELIGIBLE
  if submission.status != 'submitted': return NOT_ELIGIBLE          # only real value today; 'reviewed' also qualifies once reached
  if evidenceSummary == null: return PENDING_EVALUATION
  if evidenceSummary.metrics is empty or evidenceSummary.confidence == undefined: return NOT_ELIGIBLE   # evaluation ran but produced nothing usable — never fabricate eligibility from an empty result
  demonstrated = metrics.filter(m => m.level in ['strong','solid'])
  weak         = metrics.filter(m => m.level in ['insufficient','not_demonstrated'])
  if evidenceSummary.confidence in ['medium','high'] and demonstrated.length > weak.length and demonstrated.length >= 1:
    return policy.requireHumanConfirmation ? PENDING_HUMAN_CONFIRMATION : ELIGIBLE
  return NOT_ELIGIBLE
```

This is a **default rule, explicitly named as a default**, not a hidden constant — see open question in §30. It is count-based over qualitative levels ("more demonstrated than weak, at least one real demonstration, evaluator wasn't low-confidence"), never a percentage or a single number a screenshot could misrepresent. If the evidence pipeline fails (the OpenRouter failures seen all session), `evidenceSummary` is simply never populated — eligibility stays `PENDING_EVALUATION` honestly, exactly like the company UI already does today. **Nothing is issued on an evaluation failure.**

A company re-running evaluation (already a real action in the product) recomputes this live — since no row exists pre-issuance, re-evaluation just changes what the derived state reads next time, no stale row to reconcile.

---

## 7. Future Assessment Agent compatibility

The eligibility function's only input contract is `EvidenceSummary` (`src/lib/company/evidence-summary.ts`) — specifically `metrics: RubricMetric[]` and `confidence`. It does not know or care that this is currently produced by `evaluateCandidateEvidence`'s single AI call. When the Assessment Agent (Phase 7, multi-step plan/inspect/cross-check pipeline) replaces that function, as long as it still populates `candidate_evidence.evidenceSummary` in the same shape, the credential eligibility service needs zero changes. This is why the eligibility service is written against `candidate_evidence`, not against `evaluateCandidateEvidence` directly.

---

## 8. Future Integrity Engine compatibility

`challenges.required_integrity_mode` exists now as a nullable, unenforced column — reserved, not wired. When Phase 8 ships, the eligibility function gains one more condition: `if policy.requiredIntegrityMode is set and no integrity record meets that mode: return NOT_ELIGIBLE (or a new PENDING_INTEGRITY_REVIEW state)`. Today it's always null, so it's always satisfied. This means a **standard credential never requires proctoring** — only a challenge whose company explicitly opts into `required_integrity_mode` would ever gate on it, matching the "different policies, different assurance levels" instruction. No Integrity Engine table or logic is created in this phase.

---

## 9. Profile integration

New subsection under **Verified work & challenges** on the student profile — a sibling of the existing (self-curated) Portfolio section, never merged into it. Card shows: `display_title`, `company_display_name` (+ "Company Endorsed" badge only if `company_endorsed`), issued date, up to 3 top `rubric_snapshot` entries at `strong`/`solid` level as "Demonstrated: X, Y, Z" chips, and a small verified-indicator icon. Actions: **View credential** (→ the student's own detail view, same data as public but with owner-only edit of `is_publicly_shared`), **Share**. No "Add to profile" step for the student to perform — issuance is automatic profile placement, matching §18's "student never re-uploads it."

Revoked credentials: hidden from the profile card list by default (not deleted from DB, just not surfaced as an active achievement) — but still resolvable by anyone who already has the direct `/verify/[code]` link, which is exactly the point of §15/§11's design (a revoked credential doesn't vanish, it just stops being advertised as active work).

---

## 10. Public verification page

Route: **`/verify/[verificationCode]`** — one dynamic segment, outside `(auth)`, no session required, matches the existing unauthenticated-page pattern already used by `/opportunities/[id]`.

Server-side lookup: `verification_code` only, never the internal `id` — the public route must be unable to enumerate credentials by guessing sequential values (verification codes are random, §11).

Public payload (from snapshot columns only, plus a live `revoked_at IS NOT NULL` check so revocation is instantly reflected without needing to reissue the snapshot):

- internIn wordmark
- "Verified Challenge Credential"
- Student display name + link to public profile (only if the student's profile is itself public — doesn't force a private profile public)
- `display_title`, `company_display_name` (+ endorsed badge/logo if `company_endorsed` and `show_company_logo`)
- `completed_at`
- Demonstrated criteria list from `rubric_snapshot` (criterion + level, no rationale)
- Status: **Valid** or **Revoked** (+ `revocation_reason_public` if the company/internIn chose to set one — optional, never required)
- Credential ID (`verification_code`, human-shareable form only)

Never exposed here: `application_id`, `submission_id`, raw file paths, `submission_artifacts`, `candidate_evidence.rationale`/`evidenceQuote`, private reviewer notes (`candidate_notes` — never touched by this feature at all), student email/contact info.

A row with `is_publicly_shared = false` returns a clean "This credential is private" page (or 404 — recommend a dedicated "private" state over 404, since 404 on a code the owner genuinely shared reads as broken, whereas "private" is honest and actionable) rather than leaking whether the code exists at all beyond that binary.

---

## 11. Verification security

- `verification_code`: server-generated, cryptographically random, fixed format `INTERNIN-CH-XXXXXX` (6 base32 chars, ambiguous characters like `0/O`, `1/I` excluded) — collision handled by unique-constraint retry on insert, same pattern any signed-random-token generation would use. Never derived from the row's sequential `id`.
- Public route queries by `verification_code` only; the internal `id` is never placed in a URL, never returned in the public JSON payload.
- Revoked credentials remain queryable by code and explicitly render "Revoked" — this is what prevents "credential looked valid in a screenshot taken before revocation" from working as a forgery.
- No enumeration surface: there's no public "list all credentials" or "list a company's credentials" endpoint. Every access is by a specific known code.

---

## 12–13. PDF and company-branded PDF

New `renderCredentialPdf` in `src/lib/pdf/documents/`, following `renderChallengeDocumentPdf`'s exact structure — same `PdfcnThemeProvider` + `interninTheme`, same `PageHeader`/`PageFooter`/`Heading`/`Text`/`PdfAlert` component set already mirrored into `src/components/pdf/`. No new PDF library, no pdf-lib, no headless browser — pure reuse of the existing Takumi renderer.

Content: internIn wordmark, "Verified Challenge Credential," student name, `display_title`, `company_display_name` (+ "Company Endorsed" + logo only if `company_endorsed` and `show_company_logo` — logo rendered small, clearly subordinate to the internIn identity, never full-bleed/dominant), `completed_at`, demonstrated criteria list, credential ID, verification URL as plain text, and one issuer line:

> "This credential verifies that the named student demonstrated evidence against the published challenge rubric. Verified through internIn."

Never: "Certified expert," "guarantees," "employee," "hired," or any phrase implying an employment relationship — enforced by keeping this copy as one fixed template string, not a field any company or AI output can edit.

**QR code — honestly scoped out for v1.** Checked `src/components/pdf/` — the pdfcn/Takumi component set mirrored into this repo has no QR primitive today, and there's no `qrcode`-family package in `package.json`. Per the instruction to only add a QR "if pdfcn supports it cleanly," it doesn't yet — the PDF instead prints the verification URL as selectable text. Adding a QR component (via a further `npx shadcn add` from the pdfcn registry, if one exists there, or a small dependency) is a clean, isolated follow-up, not a blocker for this phase.

---

## 14. LinkedIn / sharing

Researched: LinkedIn's public profile "Add profile section → Licenses & certifications" form accepts a credential name, issuing organization (free text, not a verified-org lookup), issue date, and a "Credential URL" field — but there is no public API or reliable deep-link parameter set that pre-fills this from a third party for an individual user profile share flow (LinkedIn's structured "Add to Profile" button product requires a LinkedIn partnership/org integration, not just a URL scheme). Building a fake "Add to LinkedIn" deep link that doesn't actually work is worse than not having one.

**Recommendation for v1:** "Copy verification link" (the `/verify/[code]` URL) + "Download PDF" + a short instruction: "Add this to LinkedIn under Licenses & certifications — paste the verification link as the Credential URL." Honest, works today, zero fake integration. A real LinkedIn partner integration is a possible future enhancement, not architected further here since it depends on a business relationship outside this codebase's control.

---

## 15. Revocation

`status → revoked`, `revoked_at` set, `revocation_reason_internal` required (free text, never public), `revocation_reason_public` optional. No delete. The public page keeps resolving the code and shows "Revoked" — this is the whole point (§11).

**Locked decision (revised from this doc's original draft):** revoking the BASE internIn Verified Credential is internIn/system-admin-authorized only — a company can never directly revoke it, even for its own `company_endorsed` credentials. A company's own lever is narrower and separate: **withdrawing its endorsement** (`company_endorsed → false`, §12's correction above), which never touches `status`/`revoked_at` — the base credential stays `issued`. A company that believes the base credential itself is wrong can only **request internIn review** (`requestBaseCredentialReviewAction` — writes an audit event only, changes no state); an internIn admin decides whether to actually revoke. Every revocation writes an `event_log` row (`entity_type: 'challenge_credential'`, `event_type: 'credential_revoked'`); endorsement withdrawal writes `credential_endorsement_withdrawn` instead, never `credential_revoked`.

---

## 16. Audit log

Reuses `event_log` as-is — no new audit table. Implemented in Phase 4A: `credential_pending_confirmation`, `credential_issued` (fired both on direct auto-issuance and on reviewer confirmation, distinguished by `metadata.confirmedByReviewer`), `credential_confirmation_declined`, `credential_endorsement_withdrawn`, `credential_revoked`, `credential_review_requested` (a company's non-binding ask for internIn to look at a base credential — never itself a state change). Deferred to Phase 4B (needs the public page/PDF UI to exist first): `credential_downloaded`, `credential_verified` (a `/verify/[code]` page view — logged without PII, just the code and timestamp). Never logs artifact contents, private notes, or AI chain-of-thought, matching the existing `event_log` convention.

---

## 17. Human confirmation

A reviewer-facing action on the existing candidate detail page (`src/components/company/`), visible only when `challenges.require_human_confirmation = true` and the derived state is `pending_human_confirmation`: **Confirm credential** / **Not yet**. Explicit UI copy makes clear this is not a hiring decision: "Confirming issues a Verified Challenge Credential to this candidate. It does not affect their application status." Declining just leaves the state at `not_eligible` — no punitive record, no row created, no event beyond `event_log`.

---

## 18. Student experience

```
Challenge submitted
  → "Your work is being evaluated." (pending_evaluation / eligibility not yet computed)
  → if not_eligible after evaluation: no negative messaging — the challenge simply doesn't show a credential state; the student still sees their submission was received
  → if eligible / issued: "You earned a Verified Challenge Credential" banner + it appears under Verified work & challenges automatically
  → View credential / Share
```

No manual "claim" step, no re-upload — issuance (or reaching `pending_human_confirmation`) is what makes it appear; a `pending_human_confirmation` credential shows "Awaiting confirmation" on the student's own view only (never publicly resolvable via `/verify` until it's actually `issued`).

---

## 19. Rejection experience

On the application detail / status view, when `applications.status` is `declined`/`withdrawn` **and** a credential exists for that application (`issued` or `pending_human_confirmation`), surface it explicitly rather than letting a "Not selected" state read as pure loss:

> "You weren't selected for this internship, but your challenge work demonstrated [criterion, criterion] — verified and kept on your internIn profile."

Criteria list pulled from the same `rubric_snapshot`/`demonstrated` computation as everywhere else — never separately worded, never invented copy per rejection.

---

## 20. Employer experience

Reviewer sees, on the existing candidate detail page, next to the evidence panel: current derived eligibility state (or `issued`/`revoked` if a row exists) and, if `company_endorsed` is available for this challenge, the endorsement badge that will/does show. This is **read-only status display plus the confirm action from §17** — it does not add a new decision surface competing with the hiring status UI, and it never auto-suggests a hiring action based on credential state (principle 4).

---

## 21. Privacy

Two states only, per credential, student-controlled: **not publicly shared** (default — `is_publicly_shared = false`; visible to the student on their own profile/dashboard, and factually referenced to companies that already have access to that specific application through the existing application-review relationship, which they'd see anyway) and **publicly shared** (`is_publicly_shared = true` — the `/verify/[code]` link resolves for anyone with the link, and it's eligible to render on a public student profile if the student's profile is also public). No third "employers only" tier — collapsing straight from private-by-default to explicitly-public matches the instruction not to overcomplicate, and there's no real actor today ("employers in general, not this specific one") that a three-tier model would serve that the existing per-application company access doesn't already cover.

---

## 22. Credential identity

- Internal `id`: uuid, never shown to a user.
- `verification_code`: the one human-facing identifier, `INTERNIN-CH-XXXXXX` — used in the URL, the PDF, and any "Credential ID" display field. One identifier, not two (no separate "slug" — see §1, deliberately simplified from the original slug+code sketch).

---

## 23. Duplicate / reissue rules

- **One submission → one active credential.** Enforced by the partial unique index `(submission_id) WHERE revoked_at IS NULL`.
- **Re-evaluation before issuance:** no row exists yet, so a re-run just changes what the derived state computes next time — nothing to reconcile.
- **Re-evaluation after issuance:** the already-issued row and its snapshot are untouched — an issued credential does not silently change or disappear because a company re-ran evaluation later. If the new evaluation would have failed eligibility, that's a signal for a human (internIn admin) to consider revocation (§15), never an automatic downgrade.
- **Rubric changes:** since `challenge_version_id` is pinned and the rubric text itself is snapshotted, a company editing the rubric (which creates a new `challenge_versions` row, per the existing immutable-version pattern) has zero effect on any already-issued credential.
- **Revoked → reissued:** allowed, but produces a **new row** with a new `id` and a new `verification_code` (never resurrect the old code — a revoked code must permanently stay "Revoked" for anyone who saw it before reissuance; that history is a feature, not a bug, per §11's forged-screenshot rationale). The partial unique index permits this since the old row's `revoked_at` is set.
- **Application restored after decline (the exact bug class fixed in Phase 2's `application-status.ts`):** credential state is entirely independent of `applications.status` by construction (principle 4) — nothing to reconcile here at all.

---

## 24. Performance / background processing

Eligibility computation is cheap (reads two already-fetched rows, pure function, no AI call) — fine to run synchronously today, inline wherever the evaluation result is already being read (e.g. right after `evaluateCandidateEvidence` completes, and on-demand when the student's profile/applications view needs to display current state). Actual **issuance** (the DB write once eligible + not requiring confirmation) is a simple insert, also fine synchronous. Nothing here needs a Railway worker in Phase 4. When the Assessment Agent (Phase 7) moves evaluation itself off the request path onto Railway, credential issuance naturally moves with it as "one more step the evaluation job does when it finishes," not a separate async system to design now — this doc deliberately does not add a queue/worker for a computation this cheap.

---

## 25. Migration strategy (planned, not executed)

- New enum types: `credential_status`, `credential_policy`.
- New table `challenge_credentials` (§1) with the indexes listed there.
- New columns on `challenges`: `credential_policy`, `require_human_confirmation`, `show_company_logo`, `required_integrity_mode`.
- New columns on `companies`: `default_credential_policy`, `default_require_human_confirmation`.
- RLS: enable on `challenge_credentials`, `revoke all` then `grant select, insert, update` to `authenticated` (update needed only for the revoke/confirm-status transitions — no student-side update ever), following `0018_challenge_resources_rls.sql`'s exact posture (least-privilege grants, policies close the direct Supabase Data/Storage API path; the app's own server connects as the `postgres` role and enforces real authorization in code, same as every other table in this codebase). Policies:
  - `select`: the owning student (`student_id = app_user_id()`), OR a member of `company_id` (`is_company_member`), OR `is_publicly_shared = true` for `anon`/unauthenticated read (the public verify page's actual authorization still happens in the server action, matching how every other "private bucket, signed URL minted after ownership check" flow in this codebase treats RLS as defense-in-depth, not the sole gate).
  - `insert`: server-side only in practice (the eligibility/issuance service runs as the trusted `postgres` role) — the `authenticated` grant exists for API-path defense-in-depth, matching `submission_artifacts`' own "insert only, no student-authored update" posture.
  - `update`: restricted to the revocation/confirmation transition columns conceptually — enforced in application code (the confirm/revoke actions), RLS grant is the same blanket authenticated-with-policy pattern already used elsewhere in this codebase, not a column-level RLS policy (this codebase doesn't use column-level RLS anywhere today, so introducing it here would be a new pattern outside this task's scope).
- No changes to any existing table beyond the additive columns on `challenges`/`companies` above. No existing column is renamed, retyped, or dropped.

---

## 26. Security review

- **Cross-student access:** a credential's `student_id` gates the private (non-public) view exactly like every other student-owned table in this codebase (`is-owner-or-company-member` pattern already proven in `0018`/`0019`).
- **Cross-company access:** `company_id` gates company-side visibility the same way `candidate_evidence`/`submission_artifacts` already do — a company only ever sees credentials tied to its own `opportunities`/`challenges`, never another company's, mirroring the cross-tenant 404 behavior already live-verified for the evidence pipeline in Phase 3's QA.
- **Public credential enumeration:** no listing endpoint; lookup is by random `verification_code` only (§11).
- **Revoked credential behavior:** stays resolvable and explicit, by design (§11, §15) — this is a security feature, not a gap.
- **Company logo authorization:** logo only renders when the row's **current, live** `company_endorsed = true` (so a withdrawn endorsement immediately stops showing the logo — correction above) AND `show_company_logo = true` on the *governing policy at issuance* (`policy_snapshot`, frozen — a company can't retroactively inject a logo onto a credential issued under a plain `internin_verified` policy by flipping a `challenges` setting later, since the policy half of this check always reads the snapshot, never the live `challenges` row).
- **Signed/private evidence:** never touched by this feature — the credential never reads or re-exposes `submission_artifacts.storagePath`/`externalUrl`. Zero new signed-URL surface is introduced.
- **Credential spoofing:** the only mutable public-facing surface is the DB row itself, written exclusively by the trusted server-side issuance/revocation actions — no client-writable field maps to anything shown on `/verify`.
- **Verification-code collisions:** unique DB constraint + generate-and-retry, same shape as any other collision-safe random-token generator in this stack.

---

## 27. UX wireframe descriptions

**A. Student profile credential card** — compact row under "Verified work & challenges," left-aligned verified-badge icon, `display_title` as the primary line, `company_display_name` (+ endorsed pill if applicable) as secondary, up to 3 "Demonstrated" chips, issued date right-aligned, View/Share as a trailing icon-button pair. Visually distinct from Portfolio cards (which show a thumbnail + self-written description) — no thumbnail here, no student-editable fields at all.

**B. Credential detail page (student's own view)** — full snapshot rendered: title, company context, full demonstrated-criteria list (not capped at 3), completed date, credential ID, a visibility toggle ("Publicly shareable" switch — this is the `is_publicly_shared` control), Share/Copy-link/Download-PDF actions.

**C. Public verification page** — centered single-column card, internIn wordmark top, "Verified Challenge Credential" eyebrow, student name, title, company context, demonstrated list, status pill (Valid/green or Revoked/gray), credential ID + issued date in a footer row. No navigation chrome, no other internIn UI around it — it must read cleanly as a verification artifact even to someone who's never used internIn.

**D. Company credential policy setting (Challenge Settings)** — one section, three controls total: enable toggle, endorsement toggle (only enabled/visible when the first is on), logo checkbox (only visible when endorsement is on) + the separate human-confirmation toggle. No numeric inputs anywhere in this panel.

**E. Reviewer credential eligibility state (candidate detail page)** — a small status line near the existing evidence panel: "Credential: Eligible — awaiting confirmation" / "Credential: Issued" / "Credential: Not yet eligible" / "Credential: Off for this challenge," with the Confirm action appearing only in the awaiting-confirmation state. Never a progress bar, never a percentage.

**F. Credential PDF** — one page: internIn wordmark header, title block, demonstrated-criteria list as a simple bulleted section (reusing the existing `Heading`/`Text`/`View` pdfcn primitives), issuer paragraph, footer with credential ID + verification URL as plain text (no QR yet, §13).

---

## 28–29. Deliverable and phasing

This document is the deliverable for Phase 4's architecture step. Recommended implementation order once approved:

**A. Data model** — migration for `challenge_credentials`, the new enums, the additive `challenges`/`companies` columns, and RLS.
**B. Eligibility service** — the pure function in §6, read-only, no issuance yet; wire it to display derived state on the student and company sides so it's visibly correct before anything writes a row.
**C. Issuance + confirmation flow** — the actual insert path, the reviewer confirm/decline action, `event_log` wiring.
**D. Student profile integration** — the credential card (§27A) and detail view (§27B).
**E. Public verification page** — `/verify/[code]` (§10), the honest private/revoked states.
**F. PDF** — `renderCredentialPdf` (§12).
**G. Company policy UX** — the Challenge Settings panel (§27D) — this can actually land earlier or in parallel with C, since without it every challenge just runs on the `internin_verified` default.
**H. Sharing** — copy-link, LinkedIn instructions (§14).
**I. Revocation UI** — an internIn-admin (and scoped company) action for §15, lowest urgency since it's rare and can start as a direct DB action if genuinely needed before the UI exists.

Rationale for this order: data model and eligibility must exist before anything can be issued; issuance before any UI that displays it; the public page and PDF are the "portable value" payoff and should land together once issuance is proven correct on a handful of real challenge submissions.

---

## 30. Open questions for product-owner decision

1. **Default policy value.** This doc defaults `challenges.credential_policy` to `internin_verified` (opt-out) rather than `off` (opt-in), on the reading that "default system must work without company endorsement" implies credentials should be ambient, not something every company has to remember to turn on. This is a real product call, not an engineering detail — confirm before migration.
2. **Eligibility rule parameters.** §6's rule ("more demonstrated-or-better criteria than weak ones, confidence medium+, at least one real demonstration") is proposed as the v1 default. The exact bar is a product decision that affects how easy/hard a credential is to earn — confirm the rule, not just the mechanism, before implementation.
3. **Who can revoke `internin_verified` (non-endorsed) credentials.** Proposed: internIn admin only, not the company. Confirm — a company being able to unilaterally revoke a credential it didn't endorse would undercut principle 4 (credential independence from the company's own hiring feelings).
4. **Public student profile gating.** §10 links to "the student's public profile if it's public" — this assumes a public/private profile-visibility concept exists or will exist; today `student_profiles` has no visibility flag. If profile-level public visibility isn't planned soon, the credential page should stand fully alone (no profile link) rather than block on that — confirm which.
5. **LinkedIn.** Confirmed no clean deep-link integration exists (§14) — confirm the copy-link-plus-instructions fallback is acceptable for v1, since a real "Add to Profile" button requires a LinkedIn partnership outside this codebase's control.
6. **QR code.** Confirmed no pdfcn primitive or dependency exists today (§12) — confirm deferring it rather than adding a new dependency in this phase.

---

**Not done in this phase, by design:** no migration written, no `challenge_credentials` table created, no code touching `src/db/schema.ts`, no UI built, no deploy. Awaiting review of this document before any of the above starts.
