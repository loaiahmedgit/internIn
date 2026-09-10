You are now the primary engineering agent responsible for carrying internIn from the current shipped state to a functionally complete production product.

The owner does NOT want to manually prompt you after every phase.

Continue autonomously through the remaining roadmap, one coherent phase at a time, until the functional product is complete.

Do not stop after each phase merely to ask “should I continue?”

After each successful phase:
- validate it
- migrate safely if required
- commit
- push
- verify production
- update HANDOFF.md
- then continue into the next approved phase automatically

Stop only for a genuine blocker defined later in this document.

==================================================
0. CURRENT STATE / R3 CLEANUP
==================================================

Current R3 release:

commit:
2dad42a

migration:
0028

R3 functionality:
COMPLETE

deployment:
green

production student/public/mobile QA:
passed

The owner explicitly authorizes permanent deletion of EXACTLY these two synthetic QA postings:

- R3 QA Quick Apply Intern
- R3 QA Safeguarded Challenge Intern

Delete their associated synthetic:
- opportunity data
- challenge
- challenge versions
- related R3 QA audit/event rows
- synthetic submission/resource rows if any

ONLY where they belong to those QA postings.

Verify cleanup.

Do NOT delete or alter any real production opportunity, application, user, credential, program, company, or student.

Then mark:

R3 — No-Free-Labor Safeguards — COMPLETE

in HANDOFF.md.

==================================================
1. STARTUP PROTOCOL
==================================================

Before continuing:

Read completely:

HANDOFF.md
docs/13-honesty-evidence-product-alignment.md
docs/12-verified-challenge-credentials.md
design-system/internin/MASTER.md
CLAUDE.md
UI_IMPLEMENTATION_RULES.md
components.json
package.json

Then:

git status
git branch --show-current
git log --oneline -20

Inspect actual code/schema before modifying anything.

The codebase is the final technical truth where documentation and code disagree.

Preserve unrelated dirty files.

Do not stage unrelated:
.agents/
.codex/
.mcp.json
.playwright*
vault/.obsidian/
skills-lock.json
specs/
or other unrelated pre-existing workspace/tool files.

Use one focused engineering workflow/skill at a time.
Do not stack unrelated agent skills at the beginning of a task.

==================================================
2. AUTONOMY GRANT
==================================================

The product decisions in this prompt are OWNER-APPROVED.

You may implement them without asking for confirmation.

Do NOT stop for:

- naming trivia
- ordinary schema naming choices
- component choices
- internal enum names
- test fixture design
- implementation-detail decisions
- small UX decisions
- normal refactors needed to complete an approved phase
- whether to proceed to the next phase

Choose the smallest coherent production-quality implementation.

You MUST stop only if:

A. You would need to destructively modify/delete real user/company production data.

B. A paid external service requires new credentials, billing authorization, or purchase.

C. The current architecture fundamentally contradicts an owner-locked requirement and proceeding would require a destructive rewrite.

D. A legal/regulatory decision cannot safely be represented as product logic without owner/legal input.

E. Production security cannot be preserved.

Otherwise continue.

==================================================
3. MASTER PRODUCT PRINCIPLE
==================================================

internIn exists because internship candidates often have too little historical experience for CV-first screening to tell companies much.

The product should create:

REALISTIC WORK
→ OBSERVABLE EVIDENCE
→ FAST HUMAN REVIEW
→ HUMAN HIRING DECISION

Master semantic rule:

EVIDENCE OVER UNSUPPORTED CLAIMS.

Never collapse evidence into unsupported certainty.

Do NOT build:

- universal candidate suitability scores
- hiring probability
- “94% suitable”
- automatic hire/reject decisions
- universal skill verification claims
- guaranteed AI-cheating detection
- personality/culture-fit scoring
- fabricated confidence
- automatic company endorsement

Use the semantic ladder:

CLAIMED
OBSERVED
VALIDATED
DEMONSTRATED
HUMAN REVIEWED
COMPANY ENDORSED
NOT ASSESSED
NOT DIGITALLY VERIFIED
UNKNOWN

“Verified” may refer to a specific fact when genuinely verified.

Example:

VALID:
14/16 hidden tests passed.

RISKY:
React Native skill verified.

Do not imply total competence where only narrow evidence exists.

==================================================
4. ABILITY VS SUITABILITY
==================================================

Never treat these as the same thing.

A Challenge can provide evidence that someone performed specific role-relevant work under specific conditions.

It does NOT automatically establish:

- overall job suitability
- future performance
- culture fit
- motivation
- reliability over time
- teamwork over time
- physical execution
- professional maturity
- long-term consistency

Every assessment architecture must be able to answer:

WHAT THIS CAN PROVIDE EVIDENCE FOR

and

WHAT THIS CANNOT ESTABLISH

==================================================
5. INTERNS ARE NOT EXPERIENCED EMPLOYEES
==================================================

Do not assess an intern as though hiring a senior professional.

The Challenge Architect must separate:

EXPECTED BEFORE JOINING

from:

EXPECTED TO BE TAUGHT DURING THE INTERNSHIP

Assess primarily the first category.

Do not punish candidates for not knowing company-specific processes the company intends to teach.

One of the most important employer questions is effectively:

“What should this student already be capable of before joining, and what will your team teach them?”

==================================================
6. NO CV GATE
==================================================

CV must NEVER be required merely to participate in an internship opportunity.

Student Profile is the application foundation.

Profile can include:

- education
- skills
- projects
- portfolio
- certifications
- experience if any
- preferences
- links

CV remains OPTIONAL supporting context.

Do not regress into:

Upload CV → then we consider you.

==================================================
7. EVERY APPLICATION SHOULD PRODUCE SOME SKILL EVIDENCE
==================================================

This supersedes the simplistic interpretation of Quick Apply as “no evidence.”

Do NOT immediately destroy or rename the existing application_mode architecture.

Evolve it safely.

Current modes:

quick_apply
optional_challenge
challenge_required

Desired product behavior:

QUICK APPLY

Student applies using their internIn profile.
No CV requirement.
No long Challenge.
But the application should still collect a very small amount of role-relevant skill evidence where meaningful — typically 2–4 short scenario/work questions, approximately 5–15 minutes maximum.

OPTIONAL CHALLENGE

Student applies immediately with:
profile + baseline skill evidence.

A deeper Challenge is optional and can add stronger demonstrated evidence.

Not completing the optional Challenge must remain neutral.

CHALLENGE REQUIRED

Student applies with:
profile + baseline skill evidence.

Required deeper Challenge must be finally submitted before shortlist/offer progression, preserving R2’s server-side fairness gate.

Do NOT make AI evaluation a hiring progression requirement.

If preserving the enum while evolving semantics is the safest design, preserve it.

==================================================
8. OBJECTIVE ELIGIBILITY BEFORE ASSESSMENT
==================================================

A student should not enter an internship for which they fail explicit objective prerequisites.

Example:

Clinical healthcare internship requires:
Nursing / Medicine / specified health discipline.

A Mechanical Engineering student should not proceed if the company explicitly set that requirement.

But do NOT let AI invent:

“Engineer = unsuitable for healthcare.”

Another opportunity may be:

Healthcare Data Analyst Intern

where CS/engineering may be appropriate.

Eligibility must be company-defined, objective, transparent, and deterministic where possible.

Potential eligibility fields include only genuinely relevant requirements such as:

- eligible study field/major
- study level/year
- required license/certification
- required language
- location/work authorization when necessary
- hard prerequisite knowledge when truly mandatory

Eligibility ≠ suitability.

If student fails an explicit hard prerequisite:
do not start the assessment.

Show the specific unmet requirement.

Audit current application schema first before introducing anything.

==================================================
9. DUPLICATE APPLICATION / ATTEMPT PROTECTION
==================================================

One student must not accidentally or intentionally enter the same internship repeatedly.

Enforce at DB level:

one student + one opportunity = one canonical application

or equivalent existing uniqueness.

Returning students should see:

View application

not:

Apply again.

Challenge session / assigned variant must also be canonical.

A page refresh or restart must not produce a new Challenge variant.

Retries, if ever supported, require an explicit employer-controlled retry path.

Do not create “refresh until I get an easier task.”

==================================================
10. THE UNIVERSAL CHALLENGE ARCHITECT
==================================================

This is the heart of the remaining hiring product.

Do NOT build one Challenge generator per profession.

Build a universal system for:

UNDERSTANDING REAL INTERNSHIP WORK
→ IDENTIFYING ENTRY-LEVEL FOUNDATIONS
→ SELECTING THE RIGHT ASSESSMENT BEHAVIORS
→ CREATING THE SMALLEST REALISTIC ASSESSMENT
→ GENERATING APPROPRIATE RESOURCES
→ PRODUCING COMPARABLE EVIDENCE

The company speaks naturally.

Example:

“We need an intern to evaluate vendor quotes, manage purchase orders, and support negotiations.”

InternIn should understand the work and ask only what is missing.

==================================================
11. UNIVERSAL EMPLOYER INFORMATION MODEL
==================================================

InternIn needs enough information to answer these 15 universal areas:

1. What does the intern actually do on the team?

2. Give a realistic example of work a new intern would handle.

3. What output/artifact/result would they normally produce?

4. What makes that work good?

5. What mistakes would concern the company?

6. What should they already know before joining?

7. What will the company teach them?

8. What tools/files/information/resources are normally used?

9. What constraints/rules/deadlines/budgets/policies matter?

10. What can the intern decide themselves and what requires escalation?

11. What commonly changes or goes wrong while doing the work?

12. Are there competing priorities, trade-offs, or multiple possible approaches?

13. Does important work involve physical execution, real humans, safety, equipment, licensing/legal authority, or confidential information?

14. How does the actual team use AI for this work?

15. What would the company need to see someone actually do or produce before trusting them with part of this responsibility?

These are NOT 15 mandatory visible form questions.

They form the AI’s INTERNAL INFORMATION MODEL.

==================================================
12. ADAPTIVE QUESTIONING
==================================================

Do not make the employer fill a 15-question survey.

The experience should be conversational and efficient.

Start broad:

“What does this intern actually do on your team?”

Extract everything possible from the response.

Then ask only missing high-value questions.

A good detailed employer answer may require only:

2–5 follow-up questions.

A vague answer may require more.

The AI should stop questioning when it has enough information to create a fair evidence-producing assessment.

Do not question for the sake of completeness.

Do not pretend missing critical information is known.

==================================================
13. UNIVERSAL ASSESSMENT BEHAVIOR PATTERNS
==================================================

InternIn uses these as INTERNAL behavioral primitives:

Identify
Diagnose
Prioritize
Decide
Execute
Justify
Work within constraints
Handle trade-offs
Validate
Spot risks
Escalate
Adapt
Communicate
Review
Improve

For each internship, classify each pattern conceptually as:

REQUIRED
USEFUL
NOT RELEVANT

Do NOT maximize the number used.

Select the SMALLEST subset that best exposes the foundations genuinely required before joining.

==================================================
14. PATTERN SELECTION LOGIC
==================================================

Examples:

“They need to figure out what is wrong”
→ Identify / Diagnose

“Several things happen simultaneously”
→ Prioritize / Decide

“They create or modify something”
→ Execute

“They must follow strict rules”
→ Constraints / Validate

“Wrong action could cause harm”
→ Spot risks / Escalate

“Requirements frequently change”
→ Adapt

“They must explain/handover work”
→ Communicate

“Multiple valid options exist”
→ Justify / Trade-offs

“They check their own work”
→ Review / Validate

“They revise after feedback”
→ Improve / Adapt

The employer does NOT manually select these internal labels.

The AI infers them from real work.

==================================================
15. EVIDENCE MAPPING RULE
==================================================

For every selected foundation/pattern, the Architect must answer:

1. What candidate action exposes this ability?

2. What evidence/artifact/result will that action produce?

3. What can InternIn validate deterministically?

4. What needs human review?

5. What cannot be established digitally?

If a Challenge cannot create an evidence opportunity for a claimed foundation:

DO NOT claim that foundation was assessed.

==================================================
16. CHALLENGE DEPTH / TIME
==================================================

Do not introduce stupid user-facing tier names.

The product concept shown to students is simply:

Challenge · ~10 min

Challenge · ~35 min

Challenge · ~75 min

Internally you may keep a depth classification such as:

short
standard
extended

but user-facing taxonomy is unnecessary unless product UX later proves otherwise.

General active-work guidance:

SHORT:
approximately 5–15 min

STANDARD:
approximately 30–60 min

EXTENDED:
approximately 60–90 min

Above 90 active-work minutes:
exception + employer justification.

Above 120 active-work minutes:
cannot publish as a normal unpaid intern assessment.

ACTIVE WORK TIME is different from COMPLETION WINDOW.

Example:

Active work:
45 minutes

Complete within:
48 hours

Do not confuse these.

==================================================
17. CHALLENGE STYLE MUST MATCH THE WORK
==================================================

Do not force every role into a project.

Examples:

People-facing / simple-support internship:
short realistic open-ended scenarios may be the strongest evidence.

Procurement:
synthetic quotes + recommendation + PO artifact.

Software:
controlled repo + known bug/requirement.

Data:
synthetic dataset + analysis artifact.

Motion Graphics / VFX:
fictional brief + controlled assets + short deliverable.

BiW / engineering:
sanitized/synthetic CAD or engineering artifact with known constraints.

Healthcare caregiving:
scenario-based reasoning and escalation evidence, NOT fake clinical simulation.

The principle:

CREATE THE SMALLEST REALISTIC SITUATION THAT MAKES THE FOUNDATION OBSERVABLE.

==================================================
18. HEALTHCARE / CAREGIVING HARD RULES
==================================================

Healthcare requires extra restraint.

Never use:

- real patient data
- real patient identifiers
- confidential medical records
- real prescriptions
- real credentials
- private hospital datasets
- unsafe medical experimentation

Prefer:

- fully synthetic cases
- fictional patient/resident information
- company-approved SOPs/policies
- scenario-based questions
- role-boundary reasoning
- escalation reasoning
- documentation reasoning
- communication

Do not ask candidates to diagnose or prescribe unless that exact act is legitimately appropriate to their regulated role and assessment context.

For caregiving/nursing-support internships, digital evidence may cover:

- recognizing obvious concern
- prioritization
- communication
- following supplied procedure
- escalation
- scope awareness
- documentation
- risk awareness

But clearly mark:

physical caregiving execution:
NOT DIGITALLY ASSESSED / PRACTICAL VERIFICATION REQUIRED

Never imply clinical competence from written scenarios.

==================================================
19. CREATIVE / PORTFOLIO ROLES
==================================================

Existing projects/portfolio are legitimate historical evidence.

Do not pretend fresh Challenge evidence automatically outranks a strong portfolio.

Use both:

HISTORICAL EVIDENCE
+
FRESH CONTROLLED EVIDENCE

For Motion Graphics / VFX, for example:

portfolio:
shows prior work.

Challenge:
shows ability under a common brief/constraints.

Human review:
visual quality/taste/originality.

Deterministic checks:
file validity, dimensions, duration, poly count, required assets, etc. where possible.

==================================================
20. RESOURCE FACTORY — UNIVERSAL MODEL
==================================================

AI must NOT be expected to magically create every professional artifact itself.

Architecture:

Challenge Architect
→ ResourceSpec
→ Resource Router
→ generator/adapter
→ deterministic validation
→ cross-resource consistency validation
→ preview
→ company approval
→ frozen Challenge version
→ student receives resources

Universal resource classes:

1. Context / Brief
scenario
task brief
client request
requirements
incident description

2. Reference Knowledge
SOP
policy
manual
regulation
guideline
specification
API docs

3. Structured Data
XLSX
CSV
JSON
database-style extracts
transactions
inventory
measurements
schedules

4. Documents / Records
quote
invoice
purchase order
report
form
contract excerpt
fictional record

5. Visual / Media
images
video
audio
diagram
drawing
floorplan
reference design

6. Technical / Editable Assets
code repository
CAD model
3D model
design file
project file
configuration

7. Communication / Events
emails
messages
customer request
supervisor note
handoff
changed requirement
new event

8. Workspace / Tool Environment
sandbox
editor
repository
form
spreadsheet environment
annotation workspace
specialized environment where feasible

==================================================
21. RESOURCE ORIGINS
==================================================

Every resource should come from a known origin:

INTERNIN SYNTHETIC

TEMPLATE-DERIVED

TOOL / DETERMINISTICALLY GENERATED

COMPANY-PROVIDED SANITIZED / ADAPTED

Do not pretend generated materials are real company records.

Do not accept unsafe confidential production material merely for realism.

==================================================
22. RESOURCE SPEC
==================================================

Create a coherent internal ResourceSpec or equivalent.

Each resource should conceptually know:

type

purpose

which foundation(s) it helps expose

origin

assessment safety basis

ground truth availability

validator

variant family

candidate-visible filename/presentation

Do not blindly use these exact property names if the existing schema suggests a cleaner representation.

Every resource must have a reason to exist.

Do not attach random files for “realism.”

==================================================
23. MAXIMUM DELIVERABLE QUALITY
==================================================

AI creates the assessment intent.

Deterministic tools should own facts wherever possible.

Example:

AI decides:

“We need three vendor quotes where:
one misses deadline,
one has specification ambiguity,
one has commercial trade-off.”

Code generates the actual numbers/conditions.

Then professional templates render the documents.

The system therefore knows the ground truth.

Use this pattern widely.

For spreadsheets:
generate structured data deterministically.

For financial/logistics datasets:
inject known anomalies.

For code:
curated template repos + deterministic mutations/known tests.

For documents:
use professional templates, not free-form LLM layout.

For PDFs:
continue existing pdfcn/Takumi approach.

For CAD:
prefer parametric templates / curated models / sanitized company assets.
Never treat LLM-hallucinated engineering geometry as ground truth.

For 3D:
curated base assets, controlled generation, or company-sanitized files plus deterministic inspection where feasible.

For audio/video/images:
provider adapters may be added when genuinely useful.

DO NOT add fake integrations.

If an external provider requires credentials or billing not present:
implement a clean provider abstraction/fallback but do not claim it works live.

==================================================
24. CROSS-RESOURCE CONSISTENCY
==================================================

Generated professional-looking resources are useless if they contradict each other.

Build consistency validation appropriate to current architecture.

Check shared facts such as:

names
dates
quantities
currencies
budgets
IDs
deadlines
requirements
dimensions
company names
people
scenario facts
constraints

The Challenge must not say QAR 30,000 in one file and QAR 28,000 in another.

==================================================
25. COMPANY-PROVIDED RESOURCE FALLBACK
==================================================

For specialized professions, company-supplied sanitized resources may be the best option.

If InternIn cannot reliably generate a trustworthy artifact:

do NOT fake one.

Instead:

- request a sanitized/sandbox/historical-adapted resource
OR
- choose another valid assessment approach
OR
- reduce the assessment to a scenario where appropriate

HONEST FALLBACK > BAD GENERATED RESOURCE.

==================================================
26. FAIR EQUIVALENT VARIANTS
==================================================

Do not give every candidate arbitrarily different Challenges.

Preferred principle:

SAME FOUNDATIONS
SAME EVIDENCE TARGETS
SAME RUBRIC
SAME EXPECTED ACTIVE TIME
SAME TASK SHAPE
SAME INFORMATION BURDEN
SAME ALLOWED RESOURCES
COMPARABLE DIFFICULTY
DIFFERENT SURFACE DETAILS

Variants may change:

names
numbers
synthetic records
scenario surface context
specific seeded bug
product/item
ordering

but not what is being assessed.

==================================================
27. EQUIVALENCE VALIDATION
==================================================

Every variant must provide evidence opportunities for every required foundation.

Example:

Foundation:
Escalation judgment

Variant A:
dizziness scenario requires escalation

Variant B:
near-fall scenario requires escalation

Variant C:
sudden confusion scenario requires escalation

If a variant cannot expose the same required foundation:

it is NOT equivalent.

When equivalence cannot be established confidently:

USE ONE COMMON CHALLENGE FOR EVERYONE.

Fairness is more important than anti-sharing.

==================================================
28. VARIANT ASSIGNMENT
==================================================

Do not generate a random live Challenge from scratch for each candidate.

Where variants are justified:

generate a small approved family, e.g. 3–5 variants.

validate equivalence.

freeze them.

randomly/appropriately assign one when candidate starts.

persist assignment.

no reroll.

The company compares evidence against common foundations/rubric, not raw task wording.

==================================================
29. EVIDENCE OUTPUT
==================================================

The company must not end with:

Ahmed — Completed
Sara — Completed
Mohammed — Completed

That provides no hiring signal.

The result should organize candidate-specific evidence by foundation.

Example:

Risk awareness
Evidence present:
candidate identified the safety concern.

Escalation
Evidence gap:
candidate did not identify the required escalation point.

Constraint handling
Validated:
6/6 supplied requirements satisfied.

Communication
Human review required:
view response.

Physical execution
Not digitally assessed.

Never hide meaningful differences behind a single score.

==================================================
30. FAST HUMAN REVIEW
==================================================

Employer review time is a product constraint.

Target:

approximately 30–90 seconds for a reviewer to understand the candidate’s evidence at a high level.

The review experience should surface:

- foundation being assessed
- strongest evidence
- deterministic checks
- missing/weak evidence
- human-review-required items
- what was not assessed
- artifacts/resources
- candidate explanation where relevant

Then allow the human to inspect deeper.

No autonomous final decision.

==================================================
31. OBJECTIVE VALIDATION
==================================================

Where objective validation exists, use it.

Examples:

software:
tests
hidden tests
build result
required behavior

spreadsheets:
formulas
values
required fields
known anomalies

procurement:
totals
budget
delivery requirements
PO fields

engineering:
known dimensions
constraints
units
known faults

3D:
file validity
dimensions
poly count
required materials/objects

documents:
required sections/fields

Do not fabricate objectivity for:

taste
tone
empathy
creative quality
complex judgment

Those remain HUMAN REVIEW.

==================================================
32. AI PROVENANCE / INTEGRITY
==================================================

Later integrity functionality must remain evidence-based.

Never claim universal external AI detection.

Safe signals include:

- AI use inside InternIn: known when instrumented
- declared AI use
- process checkpoints
- revision/version history
- timestamps
- repository history
- cross-artifact consistency
- similarity signals
- optional oral defense/interview questions derived from work

Similarity ≠ cheating.

External AI use may remain UNKNOWN.

==================================================
33. CREATE INTERNSHIP EXPERIENCE
==================================================

Current manual creation must remain functional without AI.

But the finished product should expose TWO first-class creation paths:

CREATE WITH AI

AI leads the setup conversationally.

Employer describes the internship naturally.

AI:
understands role
asks adaptive questions
drafts internship
identifies eligibility
determines evidence approach
creates Challenge/resource plan

Everything remains editable.

Nothing publishes automatically.

CREATE MANUALLY

Employer leads the form.

AI assistance remains optional:
draft
improve
suggest
help define requirements
etc.

Both paths must converge on the SAME canonical internship/challenge domain.

Do not maintain two incompatible systems.

==================================================
34. PEOPLE & RESPONSIBILITIES
==================================================

Do NOT introduce one generic “Hiring Manager” field that replaces the existing responsibility architecture.

Pre-hire responsibilities already conceptually include:

hiring_owner
challenge_owner
reviewer
certificate_approver

Use the actual existing schema.

Supervisor is post-hire and remains different.

A supervisor may optionally be selected before hire only if architecture supports that cleanly, but final program supervisor assignment remains post-hire scoped.

Do not overload programSupervisorAssignments for pre-hire responsibilities.

==================================================
35. PUBLISH / DISTRIBUTION
==================================================

Creation should end with an explicit review/publish step.

Employer should be able to understand:

- what students see
- eligibility
- application/evidence behavior
- estimated challenge time
- Challenge/resources
- people/responsibilities
- publishing destinations

Potential publishing/distribution:

- InternIn public listing
- canonical share link
- company career page where implemented
- LinkedIn when a real integration exists
- university/partner channel later where real

Do NOT pretend integrations are live.

==================================================
36. COMPANY ENDORSEMENT — PRESERVE R1
==================================================

Base InternIn evidence credential and company endorsement are separate.

Company endorsement requires:

- explicit authorized human action
- certificate_approver assignment
- correct permission
- explicit capability selection

Never auto-endorse.

Never bundle endorsement invisibly into credential confirmation.

Do not regress R1.

==================================================
37. NO-FREE-LABOR — PRESERVE R3
==================================================

R3 is complete.

Do not regress:

- non-production assessment basis
- human acknowledgement
- duration safeguards
- AI transformation of production work
- manual-path safeguards
- confidential-data guard
- legacy honesty handling

Assessment must not become free live company work.

==================================================
38. CROSS-DOMAIN ACCEPTANCE TESTS
==================================================

The universal system must be tested against materially different internship families.

At minimum use synthetic fixtures for:

FRONT DESK INTERN

Evidence emphasis:
communication
prioritization
policy awareness
escalation
role boundaries

ELDER CARE / CARE SUPPORT INTERN

Evidence emphasis:
risk awareness
prioritization
communication
escalation
scope awareness

Must remain synthetic and non-clinical.

PROCUREMENT INTERN

Example responsibility:
evaluate vendor quotes
manage purchase orders
support negotiation

Evidence:
analysis
constraints
risk
recommendation
PO accuracy
authority/escalation

MOTION GRAPHICS / VFX INTERN

Evidence:
brief-following
technical execution
timing
constraint handling
editable artifact

Human review:
visual quality

BIW / AUTOMOTIVE ENGINEERING INTERN

Evidence:
CAD/engineering foundation
constraint handling
issue detection
technical reasoning

Do not fabricate crashworthiness verification.

SOFTWARE ENGINEERING INTERN

DATA / ANALYTICS INTERN

FINANCE INTERN

MARKETING INTERN

LOGISTICS / OPERATIONS INTERN

If the same Challenge architecture cannot sensibly support these without role-specific hacks, improve the abstraction.

==================================================
39. NEXT EXECUTION PHASES
==================================================

Execute in this order.

Do not merge everything into one mega-commit.

PHASE R4
Universal Challenge Architect

Implement:
- adaptive employer understanding
- universal role information model
- must-know vs will-teach separation
- pattern selection
- can-assess / cannot-establish reasoning
- eligibility architecture
- baseline evidence behavior for application modes
- duplicate application / canonical attempt protection
- challenge depth/time selection
- healthcare restrictions
- AI/manual creation convergence

Keep Resource Factory architecture clean but do not overbuild every specialized generator in R4.

Then validate, commit, push, deploy, update HANDOFF, continue automatically.

PHASE R5
Resource Factory + Fair Variants

Implement:
- ResourceSpec
- generator adapter architecture
- first-party high-quality generators using current stack
- deterministic ground truth
- consistency validation
- template system
- company sanitized upload path where appropriate
- fair variant families
- equivalence validation
- immutable variant assignment

Prioritize resource types that cover the most internships.

Do not block R5 waiting for exotic CAD/video services.

Then validate/deploy/update HANDOFF and continue.

PHASE R6
Evidence Engine + Fast Company Review

Implement:
- foundation → evidence mapping
- objective validators where available
- honest human-review boundaries
- candidate evidence summary
- comparison that does NOT produce universal suitability ranking
- reviewer experience optimized for fast understanding
- artifacts/deeper inspection
- honest not-assessed states

Then validate/deploy/update HANDOFF and continue.

PHASE R7
AI Provenance + Similarity + Integrity Signals

Implement:
- AI disclosure/provenance
- process/version signals
- similarity as neutral signal
- cross-artifact consistency
- candidate clarification/oral-defense question generation if useful
- never auto-accuse
- never auto-reject

Then validate/deploy/update HANDOFF and continue.

==================================================
40. POST-HIRE — EXISTING WORK MUST BE PRESERVED
==================================================

Phase 6A and Phase 6B already exist.

Preserve:

internshipPrograms
internshipWeeks
internshipTasks
supervisorFeedback
verifiedExperience
programSupervisorAssignments

Preserve:

one accepted offer → one InternshipProgram.

Do NOT redesign into cohorts.

==================================================
41. SUPERVISOR WORKSPACE
==================================================

After hiring-core completion, build the real Supervisor Workspace.

Design/function direction:

NO TABLE-DRIVEN HR SCREEN.

Supervisor manages active programs.

Top-level signals:

Active interns
Needs attention
Ready to verify
Ending soon

Main operating view should show:

intern
internship/program
current focus
progress
next thing
status
blockers
pending verification

Supervisor actions:

Confirm
Edit
Ask
Verify
Give feedback

Use assignment-scoped access.

No global supervisor identity/role shortcut.

==================================================
42. STUDENT ACTIVE INTERNSHIP WORKSPACE
==================================================

Preserve and finish:

/student/internships/[programId]

Core concepts:

Overview
My Work
Timeline
Check-ins
Feedback

Work model:

Goals
→ Milestones
→ Tasks
→ Updates
→ Blockers
→ Evidence
→ Supervisor verification
→ Feedback
→ Verified Experience

Do NOT turn InternIn into Jira.

Keep the operating experience simple.

==================================================
43. AI SUGGESTED ACTIONS
==================================================

For post-hire supervision, one strong UX/product concept is:

SUGGESTED

AI-generated actions based on observable facts.

Examples:

“Task has been blocked for 3 days.”

“Intern completed all tasks in Milestone 2 — ready for verification.”

“No weekly update submitted.”

“Program ends in 10 days — final feedback not started.”

Actions:

Assign
Dismiss
Review
Verify
Ask intern

Never say:

“Intern is underperforming.”

when the fact is merely:

“No update submitted for 6 days.”

Observation first.

==================================================
44. STUDENT / SUPERVISION AGENTS
==================================================

Student Agent may help with:

priorities
progress summaries
blockers
check-in preparation
evidence organization

Supervision Agent may help with:

blocked work
late work
verification queue
missed check-ins
ending programs
feedback due

They must never fabricate progress.

Consequential writes require user confirmation.

==================================================
45. CHECK-INS + FEEDBACK + VERIFIED EXPERIENCE
==================================================

Implement smallest coherent check-in model based on actual program/week architecture.

Prefer weekly/default recurrence where appropriate.

Student owns their check-in content.

Assigned supervisor/admin reads based on canonical authorization.

Do not create unnecessary complex workflow.

Verified Internship Experience should ultimately be based on:

real program completion
real work evidence
milestones/tasks
supervisor verification
feedback
final evaluation

Portable student value:

authenticated detail
shareable verification
PDF where appropriate

Same honesty principles as Challenge Evidence Credentials.

==================================================
46. ATTENDANCE
==================================================

Attendance is for ACTIVE INTERNSHIPS only.

Privacy rule:

NO continuous tracking.

Student explicitly taps:

Check in

Only then request location permission if required.

On-site:
compare against approved worksite geofence.

Hybrid:
location-based only for required physical days.

Remote:
do not require physical geolocation.

Possible states:

Present
Late
Absent
Excused
Remote

Design schema/policy first.

Use event-based records.

No employee surveillance product.

==================================================
47. ASK INTERNIN / FULL INTELLIGENCE ORCHESTRATION
==================================================

Long-term architecture:

UI
→ Intelligence Orchestrator
→ specialized agents
→ deterministic tools/workflows
→ InternIn DB + approved integrations

Agents:

Assessment
Hiring
Supervision
Student
Analytics/Intelligence
Integration

Safe reads/analysis may operate autonomously.

Consequential writes require confirmation.

Ask InternIn should be grounded in real scoped company/student data.

No fabricated actions or stats.

==================================================
48. INTEGRATIONS
==================================================

Integrations should reduce duplicate work.

Potential areas:

communication
calendar
work management
documents/storage
recruiting/distribution

Never display “Connected” unless truly connected.

Use provider abstractions.

When credentials are not available:
show honest unavailable/coming-soon state.

Do not block functional completion on every possible third-party integration.

==================================================
49. INTEGRITY ENGINE
==================================================

Later assessment integrity may include:

screen sharing
window/tab events
face/person presence signals
phone presence
multiple-person presence
screen-share interruption
timestamps
revision/process events

Rules:

No biometric identity database.

Computer vision may detect:

person present
multiple people
phone present

but not identify who someone is.

No automatic:

CHEATER

verdict.

No automatic fail on interruptions.

Present neutral authenticity signals to human reviewers.

Privacy must be explicit.

==================================================
50. RAILWAY / BACKEND
==================================================

Existing infrastructure:

Vercel frontend
Railway persistent backend/API/workers
Supabase DB/Auth/Storage

Railway service exists and health endpoint is live.

Do not migrate normal frontend calls to Railway merely because it exists.

Use Railway when genuinely needed for:

long-running AI agents
resource generation
queues
workers
integrations
background processing

Keep architecture measured and minimal.

==================================================
51. PERFORMANCE — LAST MAJOR ENGINEERING PHASE
==================================================

Do NOT prematurely optimize.

After feature completion, measure first.

Then inspect:

region latency
query counts
N+1
indexes
payload size
RSC/client rendering
bundle size
cache
autosave behavior
debounce
stale requests
worker queues
resource-generation latency

Abort stale client reads.

For server mutations where cancellation is unsafe, use sequencing/versioning/idempotency.

==================================================
52. FINAL DESIGN PASS — AFTER FUNCTIONALITY
==================================================

The owner explicitly wants FUNCTIONALITY FIRST.

Do not spend the next phases redesigning the entire product.

Once functional scope is complete, perform a dedicated design pass.

Known visual principles from owner-approved references:

HOME

Use a strong operational home composition:

- welcome / attention area
- active internships
- recruitment/hiring progress
- recent applicants
- upcoming deadlines/calendar
- actionable items

Home should answer:

What is happening?
What needs me?
Who just applied?
What should I do next?

ANALYTICS

Avoid generic identical KPI boxes.

Use editorial composition:

- different card sizes
- hero metric/chart
- supporting metrics
- strong large-number hierarchy
- quiet trends
- intentional spacing

TABLES

Use:

- light separators
- compact row height
- subtle status treatments
- quiet pagination
- simple far-right action menu
- filters/search/export above table
- row click/detail drawer where useful
- dense professional layout

INTERNSHIP CREATION

Use:

- focused creation workspace
- clear stepper
- Create with AI vs Manual
- Save draft
- Preview
- team responsibilities
- explicit Review & Publish
- distribution/share step
- success state with next actions

POST-HIRE TASKS

Use an AI “Suggested” actions concept as a first-class visual pattern.

Do NOT blindly copy other products’ colors/branding.

Preserve internIn identity.

==================================================
53. SECURITY
==================================================

Every new write/action must respect canonical auth.

Requirements:

- company boundary
- student ownership
- opportunity responsibility assignment
- program supervisor assignment
- explicit admin override only where product policy allows
- no cross-company leakage
- no cross-student access

RLS remains defense-in-depth where privileged DB access exists.

App-layer auth must be real.

Do not overclaim RLS.

==================================================
54. MIGRATIONS
==================================================

Prefer additive migrations.

Before every production migration:

read-only inspect relevant real data.

Do not fabricate historical facts.

Do not backfill:

consent
endorsement
attestation
supervision assignment
evidence

unless deterministic source-of-truth proves it.

Verify migration idempotency where current migration tooling supports it.

==================================================
55. TESTING
==================================================

For every phase run:

npx tsc --noEmit

eslint on touched files

focused tests

relevant regression suites

full vitest

npm run build

git diff --check

Use current HANDOFF baseline, not an old hardcoded number, because tests will increase as phases are added.

Investigate every new failure.

Do not casually label failures “pre-existing.”

==================================================
56. REAL QA
==================================================

Use synthetic test data.

Never reset the owner's real password.

Never use real student/company records destructively.

Test:

happy path
permission denial
cross-company denial
cross-student denial
mobile/narrow layout when touched
provider outage where relevant
idempotency
refresh/retry
cleanup

Fully delete synthetic:

DB rows
auth users
storage files
QA scripts

Verify cleanup.

==================================================
57. GIT / DEPLOYMENT
==================================================

For each phase:

inspect git status

stage ONLY phase files

one coherent commit per phase or tightly related closure fix

push main

apply production migration safely

verify production

verify exact deployed SHA where tooling permits

If exact SHA cannot be verified:
say so honestly.

Do not create meaningless commits for QA-only “no change” results.

==================================================
58. HANDOFF.md IS MANDATORY
==================================================

Update HANDOFF.md after EVERY completed phase.

It must contain:

current phase status
commit SHA
migrations
architecture decisions
schema changes
tests
QA
deployment status
known provider limitations
known bugs/limitations
next exact phase

This is critical because credits/context may run out.

==================================================
59. IF CONTEXT / CREDITS RUN LOW
==================================================

Do not leave the project in an ambiguous state.

Before stopping because of agent/session limitations:

1. finish the smallest safe atomic unit
2. avoid half-applied migrations
3. commit completed coherent work if clean
4. push only if production-safe
5. update HANDOFF.md in detail
6. state NEXT EXACT ACTION
7. preserve all owner decisions from this prompt

The next agent must be able to resume without asking the owner to explain anything again.

==================================================
60. DEFINITION OF FUNCTIONALLY COMPLETE
==================================================

Do not declare InternIn complete merely because screens exist.

Functional completion means:

- companies can create internships manually or with AI guidance
- applications do not require CV
- objective eligibility works
- duplicate applications are prevented
- every application can produce meaningful skill evidence
- Challenge depth adapts to the role
- adaptive employer questioning works
- universal Challenge Architect works across materially different industries
- resources are trustworthy/professional
- fair variants work where appropriate
- evidence is mapped honestly
- company review is fast and human-controlled
- credentials remain honest
- endorsement remains explicit
- student active internship workflow works
- supervisors have assignment-scoped operating workspace
- work/tasks/blockers/evidence/check-ins/feedback operate coherently
- verified internship experience works
- attendance is privacy-preserving
- Ask InternIn is grounded
- relevant integrations are real or honestly unavailable
- integrity signals do not accuse
- production security is preserved
- performance is measured and corrected
- final design pass is coherent
- synthetic QA data is removed
- HANDOFF is current

==================================================
61. FINAL REPORT ONLY WHEN COMPLETE OR GENUINELY BLOCKED
==================================================

Do not return a “phase done, should I continue?” report.

Continue automatically.

When the entire approved roadmap is complete, return a final report covering:

- phases completed
- final production SHA
- migrations
- current architecture
- key product behavior
- tests
- QA
- security
- performance
- external integrations/providers
- remaining honest limitations
- HANDOFF state
- production URLs
- whether InternIn is functionally ready for real company/student pilot

If blocked under the explicit stop conditions above:

return ONLY the blocker,
what has already been completed,
and the exact smallest owner action required.

Otherwise:

KEEP GOING.