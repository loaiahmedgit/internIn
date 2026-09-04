# Agentic Architecture Direction

Product/architecture direction for all future AI work, not a build spec for today. Every future AI feature gets checked against this before implementation.

## Core idea

internIn should not be normal dashboard software with random AI features bolted on. The platform should feel intelligent by default.

Long-term shape:

```
UI / Dashboard
  → Ask internIn / Intelligence Orchestrator
  → specialized autonomous agents
  → deterministic tools/workflows
  → internIn database + integrations
  → grounded actions/results
```

The agent layer sits **on top of** the existing deterministic backend, not in place of it. Never replace safe deterministic backend logic with free-form AI.

## The five agents

**1. Assessment Agent** — autonomous evaluator for candidate work. Not a hiring decision-maker: its job is to inspect a submission and produce a serious, grounded assessment. It should be able to inspect every submitted artifact, decide which inspection tools it needs and in what order, go deeper when something is unclear, cross-check claims across artifacts, verify submission requirements, gather evidence per rubric criterion, retry/re-plan when evidence is incomplete, and explicitly say "insufficient evidence / requires human review" rather than guess. Output: requirement completion, correctness, reasoning, technical execution, communication, evidence use, professionalism, strengths, concerns, confidence, grounded citations. Example flow: submission arrives → agent reads challenge + rubric → creates an inspection plan → opens the XLSX → reads the PDF → inspects the GitHub repo → compares findings → checks each rubric criterion → verifies evidence → produces a structured assessment.

It must never autonomously output "Hire," "Reject," "Best candidate," "Recommended for hiring," a ranking, or a final hiring decision. The human employer stays responsible for the hiring verdict — this is a hard rule, not a style preference.

**2. Hiring Agent** — HR/company workflows: create/refine internships, generate challenges and challenge resources, inspect the pipeline, summarize candidate status, identify review bottlenecks, draft outreach, explain what needs attention, prepare reports, answer workspace questions. Ask internIn orchestrates these as tools.

**3. Supervision Agent** — active internship programs. Understand intern progress, summarize work/check-ins, detect blockers, notice overdue updates, surface items ready for verification, prepare supervisor follow-ups, draft evaluation summaries, explain who needs attention and why. Follows the NASQ philosophy below: understand work context without surveillance — no keystroke logging, no invasive monitoring, only explicit work evidence, updates, integrations, and approved context.

**4. Student Agent** — explain challenge requirements, organize what remains unfinished, help the student understand feedback, surface deadlines, help structure progress updates, help reflect on internship work. It must not do the assessment/challenge work for the student.

**5. Analytics / Intelligence Agent** — dashboard intelligence should explain, not just count. Instead of "12 applicants," surface "4 applicants have been waiting for review for more than 3 days." Instead of "2 blocked interns," surface "Sara has been blocked on API access since Tuesday and has a check-in tomorrow." Questions it should answer: Why did applications drop? Which internship is moving slowly? What needs attention today? Which interns are blocked? Where are candidates dropping out? What changed this week? It inspects real workspace data and explains it — never invents a trend that isn't in the data.

## Integration agent / tools

Long-term, agents may use approved integrations — Slack, Teams, Jira, Linear, GitHub, Calendar, email, Drive, etc. Only authorized integration context, ever. No surveillance behavior.

## Architectural rule: no giant magical agent

Central orchestrator → specialized agents → narrow deterministic tools. Never one agent that owns everything.

Example tool shapes: `get_internship`, `get_candidates`, `get_submission`, `get_challenge`, `get_rubric`, `read_document`, `analyze_spreadsheet`, `inspect_repository`, `inspect_image`, `transcribe_media`, `get_program_progress`, `get_blockers`, `create_challenge_draft`, `save_evaluation`, `draft_message`, `query_analytics`.

The agent decides which tools to call and in what order. Tools stay responsible for authorization, validation, database writes, side effects, security, and deterministic rules — the agent never gets to skip these by reasoning around them.

## Human control

Safe reads and analysis can be autonomous. Consequential actions must stay human-controlled — sending an offer, rejecting a candidate, publishing an internship, sending external communication, modifying important program records. An agent may prepare, draft, or recommend; it must never silently execute a consequential action.

## NASQ philosophy

The strongest idea to inherit: software should understand work and surface what matters automatically, instead of forcing users to manually maintain dashboards. Proactive, contextual, evidence-based, integration-aware, privacy-preserving. Not surveillance, not a static dashboard, not a generic chatbot bolted onto a SaaS app.

## Relationship to the current challenge engine

The challenge engine (Challenge → Resources → Tasks → Submission Requirements → Rubric → Submission Artifacts → Evidence Analysis) is the foundation the Assessment Agent orchestrates on top of. Do not throw it away or route around it — future agentic assessment work extends this model, it doesn't replace it. The existing grounded-evidence pipeline (`src/lib/company/evidence-evaluation.ts`, `evidence-summary.ts`'s quote-verification and reused-quote/ungrounded-metric downgrade rules, the forbidden hiring-verdict language enforced in both `gemma-provider.ts` and `mock-provider.ts`) is exactly the kind of deterministic safety rail this architecture depends on — the Assessment Agent's autonomy is bounded by tools like these, not free of them.
