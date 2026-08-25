# Graph Report - docs  (2026-08-25)

## Corpus Check
- 2 files · ~3,620 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 87 nodes · 109 edges · 26 communities (9 shown, 17 thin omitted)
- Extraction: 50% EXTRACTED · 50% INFERRED · 0% AMBIGUOUS · INFERRED: 55 edges (avg confidence: 0.81)
- Token cost: 0 input · 81,754 output

## Community Hubs (Navigation)
- Data Model & Company/Public Routes
- Pricing, MVP Scope & Verified Experience
- AI Challenge Generation & Safety
- AI-Assisted Program Building
- Landing Page Narrative Hook
- Internship Creation via AI
- Candidate Review & Selection
- Brand Tagline & Closing CTA
- Candidate Evidence Page
- Student Challenge Workspace
- Navbar & Wordmark
- Core Problem Statement
- Product Identity
- Challenge Type Catalog
- Worked Challenge Example
- Practice / Training Layer
- Smart Matching
- Internship Workspace
- Pricing Section (Landing Page)
- Gemma 26B A4B (MoE)
- Gemma 31B (Dense)
- Model Routing Strategy
- Brand Attributes
- Anti-Generic-SaaS Design Rule
- Brand Typography
- Brand UI Patterns

## God Nodes (most connected - your core abstractions)
1. `Data Model (Core Entities)` - 23 edges
2. `MVP Scope (Explicit Cut List)` - 11 edges
3. `Example End-to-End Journey (Qatar Insurance Company)` - 10 edges
4. `AIProvider Abstraction Layer` - 8 edges
5. `Student Pages` - 8 edges
6. `Company Pages` - 8 edges
7. `Challenge Builder` - 6 edges
8. `Placement Fee: QAR 499 per Successful Intern` - 6 edges
9. `Free to Start, Pay When You Hire (v1 Model)` - 5 edges
10. `Company` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Section 7 — After Hiring` --conceptually_related_to--> `VerifiedExperience`  [INFERRED]
  07-landing-page.md → 08-page-list-and-data-model.md
- `Brand Tagline: Connecting Ambition With Opportunity` --semantically_similar_to--> `Tagline: Connecting Ambition With Opportunity`  [INFERRED] [semantically similar]
  10-brand-identity.md → 00-product-concept.md
- `The Moat (network + evidence data)` --semantically_similar_to--> `Company Value Proposition`  [INFERRED] [semantically similar]
  00-product-concept.md → 06-monetization.md
- `AI-Usage Modes (Open/Allowed/Restricted/Controlled)` --conceptually_related_to--> `Challenge Builder`  [INFERRED]
  02-student-flow.md → 01-company-flow.md
- `Section 5 — AI Challenge Builder` --conceptually_related_to--> `Challenge Builder`  [INFERRED]
  07-landing-page.md → 01-company-flow.md

## Hyperedges (group relationships)
- **MVP Payment Stub Resolution Group** — docs_06_monetization_free_to_start_pay_when_you_hire_v1_model, docs_06_monetization_placement_fee_qar_499_per_successful_intern, docs_08_page_list_and_data_model_payment_stub_decision, docs_08_page_list_and_data_model_mvp_scope_explicit_cut_list [EXTRACTED 1.00]
- **V1 Page Taxonomy** — docs_08_page_list_and_data_model_public_pages, docs_08_page_list_and_data_model_student_pages, docs_08_page_list_and_data_model_company_pages, docs_08_page_list_and_data_model_admin_pages [INFERRED 0.75]
- **AI Proposes, Company Controls Principle** — docs_00_product_concept_core_principle, docs_01_company_flow_challenge_editor, docs_04_internship_program_builder_ai_internship_builder, docs_03_candidate_evidence_and_comparison_candidate_evidence_page [INFERRED 0.85]
- **Synthetic Data Anti-Exploitation Pattern** — docs_05_anti_exploitation_rule_anti_free_labor_rule, docs_01_company_flow_challenge_builder, docs_09_ai_architecture_and_model_choice_generatesyntheticscenario, docs_07_landing_page_privacy_section [INFERRED 0.85]

## Communities (26 total, 17 thin omitted)

### Community 0 - "Data Model & Company/Public Routes"
Cohesion: 0.15
Nodes (20): The Moat (network + evidence data), Company Value Proposition, Admin Pages, CandidateEvidence, ChallengeAsset, ChallengeTask, Company, Company Pages (+12 more)

### Community 1 - "Pricing, MVP Scope & Verified Experience"
Cohesion: 0.24
Nodes (14): Student Profile, AI as Infrastructure, Not a Billable Line Item, Free to Start, Pay When You Hire (v1 Model), Later Pricing Tiers (Starter, Pro, Enterprise, Universities), Placement Fee: QAR 499 per Successful Intern, Student Value Proposition, Application, Challenge (+6 more)

### Community 2 - "AI Challenge Generation & Safety"
Cohesion: 0.31
Nodes (9): Challenge Builder, AI-Usage Modes (Open/Allowed/Restricted/Controlled), Anti-Free-Labor Rule, Section 5 — AI Challenge Builder, Section 8 — Privacy, AIProvider Abstraction Layer, generateChallenge(), generateRubric() (+1 more)

### Community 3 - "AI-Assisted Program Building"
Cohesion: 0.33
Nodes (6): Core Principle: AI Does Not Hire People, Challenge Editor, AI Internship Builder, Section 7 — After Hiring, editChallenge(), generateInternshipProgram()

### Community 4 - "Landing Page Narrative Hook"
Cohesion: 0.40
Nodes (5): The Reframe (challenge-based hiring flow), Hero Section ("Experience shouldn't be required..."), Landing Page, Section 2 — The Paradox, Brand Color Palette (Teal/Navy/Gray)

### Community 5 - "Internship Creation via AI"
Cohesion: 0.50
Nodes (4): Build with AI (internship listing generation), Create an Internship, Section 4 — For Companies, generateInternship()

### Community 6 - "Candidate Review & Selection"
Cohesion: 0.50
Nodes (4): Reviewing Candidates (company flow step), Candidate Comparison, Invite to Internship, compareCandidates()

### Community 7 - "Brand Tagline & Closing CTA"
Cohesion: 0.67
Nodes (3): Tagline: Connecting Ambition With Opportunity, Final CTA — Give Talent a Way In, Brand Tagline: Connecting Ambition With Opportunity

### Community 8 - "Candidate Evidence Page"
Cohesion: 0.67
Nodes (3): Candidate Evidence Page, Section 6 — Candidate Evidence, summarizeCandidate()

## Knowledge Gaps
- **34 isolated node(s):** `AI-Usage Modes (Open/Allowed/Restricted/Controlled)`, `Practice / Training Layer (post-MVP)`, `Section 5 — AI Challenge Builder`, `Section 8 — Privacy`, `Challenge Workspace` (+29 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `VerifiedExperience` connect `Pricing, MVP Scope & Verified Experience` to `Data Model & Company/Public Routes`, `AI-Assisted Program Building`?**
  _High betweenness centrality (0.238) - this node is a cross-community bridge._
- **Why does `Section 7 — After Hiring` connect `AI-Assisted Program Building` to `Pricing, MVP Scope & Verified Experience`?**
  _High betweenness centrality (0.233) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `Data Model (Core Entities)` (e.g. with `Admin Pages` and `Company Pages`) actually correct?**
  _`Data Model (Core Entities)` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `MVP Scope (Explicit Cut List)` (e.g. with `Company Pages` and `Opportunity`) actually correct?**
  _`MVP Scope (Explicit Cut List)` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `Example End-to-End Journey (Qatar Insurance Company)` (e.g. with `Application` and `InternshipOffer`) actually correct?**
  _`Example End-to-End Journey (Qatar Insurance Company)` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 8 inferred relationships involving `Student Pages` (e.g. with `Student Value Proposition` and `MVP Scope (Explicit Cut List)`) actually correct?**
  _`Student Pages` has 8 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AI-Usage Modes (Open/Allowed/Restricted/Controlled)`, `Practice / Training Layer (post-MVP)`, `Section 5 — AI Challenge Builder` to the rest of the system?**
  _34 weakly-connected nodes found - possible documentation gaps or missing edges._