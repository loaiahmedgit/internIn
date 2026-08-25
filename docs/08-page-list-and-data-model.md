# V1 Pages, Data Model & Anti-Scope

## Public pages
`/`, `/opportunities`, `/opportunities/[id]`, `/companies/[id]`, `/pricing`, `/signin`, `/signup`

## Student pages
`/student/home`, `/student/profile`, `/student/applications`, `/student/challenges/[id]`, `/student/internships/[id]`, `/student/experience`

## Company pages
`/company/home`, `/company/opportunities`, `/company/opportunities/new`, `/company/opportunities/[id]`, `/company/challenges/builder`, `/company/candidates/[id]`, `/company/compare`, `/company/internships/[id]`

## Admin

Basic moderation only, later.

## Data model (core entities)

User, StudentProfile, Company, CompanyMember, Opportunity, Challenge, ChallengeTask, ChallengeAsset, Application, Submission, SubmissionArtifact, CandidateEvidence, Interview, InternshipOffer, InternshipProgram, InternshipWeek, InternshipTask, SupervisorFeedback, VerifiedExperience.

Important entities should be proper relational tables — do not implement the important business entities as JSON blobs.

## MVP scope (explicit cut list)

The MVP should only prove: "Will companies give students a chance if we make skill verification easy?"

**Build:**
- Student: Profile, Browse challenges, Open challenge, Submit work, See status
- Company: Create company, Describe intern role to AI, AI generates Challenge, Edit Challenge, Publish, See applicants, Review submissions, Invite student

**Explicitly do NOT build in v1:** university dashboard, webcam/locked-browser proctoring, advanced LMS, full skill-learning/practice platform, giant CV-parsing AI.

**Resolved:** payments ARE part of the MVP demo, since "pay when you hire" is the core business model (see 06-monetization.md) and "Invite to Internship" must visibly trigger the QAR 499 placement fee to prove the thesis end-to-end. For the MVP, the QAR 499 charge itself is **stubbed** — no real payment processor integration (no Stripe/PayFort/etc.) — the unlock flow (offer → Internship Program Builder → management workspace) fires on a mocked/manual "paid" state rather than a real transaction.

## Example end-to-end journey (illustrative)

Qatar Insurance Company creates a Business Analyst Intern opportunity. Manager talks to AI for ~5 minutes; AI produces a Business Challenge around a simulated 18% rise in customer complaints, using anonymized simulated data. 100 students see it, 40 apply, 25 finish. The company reviews Candidate Evidence for all 25, shortlists 5, interviews 3, hires 2, then clicks "Generate 8-week internship plan." Interns complete the Internship Program and receive Verified Experience at the end.
