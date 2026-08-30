# Hiring Workspace verification — 31 August 2026

Status: implementation verified locally; production deployment authorized for live-browser QA. Browser QA is pending.

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

- Unit/regression suite: 78 tests passed across 9 files.
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
| Rendered visual/interaction verification | Unverified; disposition remains **fix until browser verification**. |

## Pending real-browser QA

Use the dedicated `internin-qa` Chrome session the user requested and signed into. Local OAuth redirected to the production domain; the user authorized pushing first and testing the live deployment in this same browser. Do not extract or transfer session credentials.

- Capture all six hiring screens at desktop and responsive widths, compare supplied references.
- Verify candidate internship filters, stage tabs, search, sort, pagination, archive access, and export.
- Verify full candidate profile navigation and stage-specific actions in all four stages.
- Verify generated source excerpts against actual files; test AI-disabled state on profile and legacy submission route.
- Verify Settings save/reload, unsaved-change warnings, multiple permissions, and member notification preferences.
- Verify keyboard navigation, focus, responsive overflow, errors/loading, and no stale hiring navigation labels.

No authenticated UI, save/reload round trip, AI provider evaluation, or production deployment is claimed as tested in this pass.
