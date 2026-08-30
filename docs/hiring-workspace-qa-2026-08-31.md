# Hiring Workspace verification — 31 August 2026

Status: pushed to production; live browser QA passed for the screens and workflows below. AI-provider round-trip remains explicitly unverified for the permission reason below.

## Implemented scope

- Navigation: Home, Internships, Candidates, Analytics, Integrations, Settings. Existing program routes/data remain; no program UI was built.
- Home: operational hiring metrics, pipeline, separate internship health, review/deadline/offer attention, recorded activity, and upcoming deadlines.
- Analytics: hiring-only metrics and responsive charts/tables, real date cohorts, current stages, recorded sources, and scoped CSV export.
- Settings: persisted general/branding details, member access grants, per-member notification preferences, and workspace AI control. Permissions are access-based and support multiple grants, including future program supervisors. Existing members can be managed; an invitation workflow was not invented.
- Candidate profiles: existing structure retained; AI Evidence Summary uses source excerpts validated against readable CV/submission text. Self-reported profile data is labeled. Unread files, absent timestamps, and unverified task completion are explicit.
- Candidates list and Integrations design were not changed. Internships changed only its data loader; table markup is unchanged.

## Data consistency

Read-only database verification confirmed five distinct internship postings:

| Internship | All applications | Active reviewable | Archived |
| --- | ---: | ---: | ---: |
| Customer Success Intern | 6 | 4 | 1 |
| Data Analyst Intern | 9 | 7 | 1 |
| Finance Intern | 2 | 1 | 1 |
| Marketing Intern | 8 | 6 | 1 |
| Product Operations Intern | 5 | 3 | 1 |
| Total | 30 | 21 | 5 |

The remaining four applications await submission. Applicants includes historical and pre-submission records; Active candidates includes only To review, Shortlisted, and Offer sent. Offers pending excludes accepted offers. Time to hire requires a recorded acceptance event, never a mutable update timestamp. Source performance reports unrecorded attribution honestly.

## Database migration note

Seven additive columns were applied to the configured database and verified. No existing records or columns were removed. The database predates the current Drizzle migration ledger, so replaying all migrations would attempt to recreate an existing enum. `scripts/apply-hiring-workspace-migration.mjs` applies only these seven columns idempotently. Historical migration-ledger reconciliation was deliberately not attempted. Migration SQL and snapshots are included for clean databases.

## Automated checks

- Unit/regression suite: 82 tests passed across 12 files.
- Production build: `npx next build --webpack` passed.
- TypeScript: `npx tsc --noEmit` passed.
- Targeted ESLint and `git diff --check`: passed.
- Impeccable source detector: one pass, no findings. This is not visual verification.
- HTTP checks: Home, Internships, Candidates, a candidate profile, Analytics, Integrations, Settings, and analytics export all redirect unauthenticated requests to sign-in.

## Independent review

The requested Impeccable-specific reviewer role was unavailable; a fresh, read-only review agent was used as a substitute.

| Finding | Verdict |
| --- | --- |
| Cached-layout authorization | Resolved: feature checks run in data/action boundaries; program data requires supervisor access. |
| AI toggle bypass on legacy submission page | Resolved: same controlled evidence component is used there. |
| Historical submission evaluated against latest content | Resolved: exact requested submission ID is owner-scoped through evaluation and persistence. |
| Rendered desktop visual verification | Passed independent review of nine screenshots; no blocking visual regressions. |

## Production and live-browser QA

Use the dedicated `internin-qa` Chrome session the user requested and signed into. Local OAuth redirected to the production domain; the user authorized pushing first and testing the live deployment in this same browser. Do not extract or transfer session credentials.

- All six hiring screens returned 200 in the initial capture pass at 1672px desktop and 390px mobile; no document-level horizontal overflow. Screenshots saved locally under `.playwright-cli/hiring-*` (not committed).
- Final navigation contains exactly Home, Internships, Candidates, Analytics, Integrations, Settings.
- Candidate pagination: 10 / 10 / 1 active records across three pages. Each of the five internship filters matched its real counts. Data Analyst stage tabs, search, and archive/back navigation passed.
- Data Analyst scoped CSV exports: active 7, archived 1, all reviewable 8. Pre-submission applications are not reviewable candidates.
- After the connection-mode fix: Analytics 7/90/30-day ranges and CSV report download passed; chart titles are populated and no hydration errors occurred. Home's pipeline internship selector passed. Internships → View candidates retained the Data Analyst filter with seven active records; scoped oldest-first sorting passed. No client errors were recorded in this cross-page pass. All eight integration image assets loaded successfully.
- All five Settings sections rendered. Notification preference save/reload passed, the original value was restored, and unsaved-navigation cancellation stayed on the form. No team permissions, candidate stages, or offers were changed.
- All four full profiles passed: Sara Hijazi (To review: Shortlist / Send offer plus Reject in overflow), Marwan Sultan (Shortlisted: Send offer plus review/reject in overflow), Dana Qassim (Offer sent: one View offer action), Lina Barakat (Rejected: Restore to review only). Reject confirmation was opened then cancelled. Resume, Challenge, Notes, Activity, and Overview navigation passed. No redundant opportunity/recruiter fields, old Not selected/Withdraw offer wording, or disabled stage decorations were present.
- The fixed deployment reported no server error logs during the repeat navigation/profile checks.
- Mobile profile measured 390px content at a 390px viewport; the six-item drawer navigated correctly to Home. Visual inspection found Activity clipped in the profile tab row; scoped horizontal scrolling was added without changing desktop layout.

### Issues found and fixed during live QA

- Analytics SVG chart titles produced a React hydration mismatch because the server rendered multi-child `<title>` content as empty. Replaced with a single string child; added an SSR regression test. Commit `df14452`.
- Repeated navigation exposed Supabase `EMAXCONNSESSION` errors (15 session-client limit). Bounded each client pool to two connections with a 20-second idle timeout (`3b1ea24`). Since session-mode exhaustion recurred, verified a read-only `SELECT 1` against the same database's transaction endpoint, then switched only Vercel runtime shared-Supabase-pooler URLs from port 5432 to 6543 (`b19e66b`). Direct/custom/local database URLs remain unchanged. Prepared statements remain disabled. See [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).

### Explicit verification limits

- The live AI-provider round-trip was blocked by auto-review because it sends candidate CV/submission content to OpenRouter and persists derived excerpts. The call did not run; no files were transmitted by this test. Explicit approval for that specific data transfer is required to complete this check. Offline tests cover exact-source quote validation, unsupported/external files, ownership, historical-submission selection, and the AI-disabled boundary.
- Owner access grants were inspected but not changed on production. No offers were sent, accepted, rejected, or withdrawn during QA.

Production feature commit: `e466aeb`. Latest runtime fix at this point: `b19e66b` (Vercel READY). Live site: https://www.internin.app.
