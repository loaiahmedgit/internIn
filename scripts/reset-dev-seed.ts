import { getDb, schema } from "../src/db";
import { eq, or, inArray } from "drizzle-orm";
import { createAdminClient } from "../src/lib/supabase/admin";
import { generateResourceFile } from "../src/lib/challenges/resource-generation";
import type {
  ResourceContentSpec,
  SubmissionRequirement,
  ChallengeResourceType,
  SubmissionArtifactKind,
} from "../src/lib/challenges/submission-model";

/**
 * Deterministic dev-data reset for the universal work-sample challenge
 * engine. Four operations, run every time this script runs:
 *
 *  1. Removes clearly-identified junk test fixtures (opportunities whose
 *     `location` literally duplicates a work mode, e.g. "Remote", or reads
 *     "Not set yet" — confirmed via a live audit to be manual QA leftovers)
 *     and one genuinely dead draft (0 applications, no challenge at all).
 *  2. Deletes and recreates exactly 5 opportunities tagged with one of the
 *     SEED_DEPARTMENTS below (so re-running this script never duplicates
 *     them), each with a real, fully-populated Challenge — scenario, tasks,
 *     real generated resource files in private Storage, weighted rubric,
 *     submission requirements.
 *  3. Upgrades every remaining pre-P0 opportunity's challenge (the existing
 *     demo-candidates pipeline fixtures used by the company Candidates/
 *     Analytics pages — real applications attached, not touched) to a
 *     complete new-model version: same real scenario/tasks/rubric text as
 *     before, now with real generated resource files and submission
 *     requirements added. Idempotent — skipped once a version already has
 *     submissionRequirements. A new ChallengeVersion is appended (never
 *     overwritten in place), so any existing submission stays pinned to
 *     the exact version it was actually given.
 *  4. Demo student applications covering every real application/challenge/
 *     submission state.
 *
 * Never touches: the real company row itself, real Supabase Auth-backed
 * users, or any existing application/submission/candidate_evidence row.
 */

const SEED_DEPARTMENTS = ["Data & Analytics", "Design", "Marketing", "Engineering", "Finance"] as const;

function taskId() {
  return crypto.randomUUID();
}
function reqId() {
  return crypto.randomUUID();
}

interface SeedFile {
  name: string;
  description: string;
  resourceType: ChallengeResourceType;
  artifactKind: SubmissionArtifactKind;
  contentSpec?: ResourceContentSpec;
}

interface SeedOpportunity {
  role: string;
  department: (typeof SEED_DEPARTMENTS)[number];
  shortDescription: string;
  description: string;
  whatYouWillLearn: string;
  requirements: string[];
  skills: string[];
  duration: string;
  hoursPerWeek: number;
  location: string;
  workMode: "remote" | "onsite" | "hybrid";
  applicationDeadline: Date | null;
  challenge: {
    title: string;
    scenario: string;
    estimatedMinutes: number;
    estimatedDurationLabel: string;
    skills: string[];
    tasks: { title: string; description: string }[];
    files: SeedFile[];
    rubric: { criterion: string; description: string; weight: number }[];
    submissionRequirements: Omit<SubmissionRequirement, "id">[];
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY_MS);
}

const SEED_OPPORTUNITIES: SeedOpportunity[] = [
  {
    role: "Data Analyst Intern",
    department: "Data & Analytics",
    shortDescription: "Analyze regional sales data and recommend where the business is losing money.",
    description:
      "Join the analytics team to investigate a real (synthetic) sales performance problem: three product lines are underperforming across two regions, and leadership wants to know why before next quarter's planning cycle.",
    whatYouWillLearn: "How to clean messy multi-source data, join it correctly, and turn a spreadsheet into a decision a manager can act on.",
    requirements: ["Clean and merge three real data files", "Identify the true driver behind the underperformance", "Present findings a non-technical manager can act on"],
    skills: ["Excel", "SQL", "Data Analysis", "Data Visualization"],
    duration: "8 weeks",
    hoursPerWeek: 20,
    location: "Doha, Qatar",
    workMode: "hybrid",
    applicationDeadline: daysFromNow(21),
    challenge: {
      title: "Regional Sales Performance Analysis",
      scenario:
        "You've joined the analytics team at a fictional consumer goods distributor. Three product lines have underperformed across two regions for the past quarter, and leadership needs a clear, data-backed explanation before the next planning cycle — not a guess.",
      estimatedMinutes: 120,
      estimatedDurationLabel: "1.5–2 hours",
      skills: ["Excel", "SQL", "Data Analysis", "Data Visualization"],
      tasks: [
        { title: "Clean the raw data", description: "Review raw_sales_export.csv for duplicate rows, inconsistent region codes, and missing prices, and produce a clean working copy." },
        { title: "Merge the three files", description: "Join the sales export against product_catalog.csv and region_mapping.csv so every order has a real product name, category, and region name." },
        { title: "Analyze the underperformance", description: "Identify which product/region combination is actually driving the shortfall, and rule out at least one plausible-but-wrong explanation." },
        { title: "Visualize and recommend", description: "Build one chart that makes the driver obvious, and write a specific, actionable recommendation — not a general observation." },
      ],
      files: [
        {
          name: "raw_sales_export.csv",
          description: "Raw order-level sales export for the past quarter, exactly as pulled from the order system — unclean on purpose.",
          resourceType: "file",
          artifactKind: "dataset",
          contentSpec: {
            kind: "spreadsheet",
            columns: [
              { name: "order_id", dataType: "text" },
              { name: "region_code", dataType: "text" },
              { name: "sku", dataType: "text" },
              { name: "units_sold", dataType: "number" },
              { name: "unit_price", dataType: "number" },
              { name: "order_date", dataType: "date" },
            ],
            rowCount: 60,
            rowGenerationHint: "order",
          },
        },
        {
          name: "product_catalog.csv",
          description: "Product catalog mapping each SKU to its name, category, and unit cost.",
          resourceType: "file",
          artifactKind: "dataset",
          contentSpec: {
            kind: "spreadsheet",
            columns: [
              { name: "sku", dataType: "text" },
              { name: "product_name", dataType: "text" },
              { name: "category", dataType: "text" },
              { name: "unit_cost", dataType: "number" },
            ],
            rowCount: 18,
            rowGenerationHint: "product",
          },
        },
        {
          name: "region_mapping.csv",
          description: "Maps each internal region code to a real region name and country.",
          resourceType: "file",
          artifactKind: "dataset",
          contentSpec: {
            kind: "spreadsheet",
            columns: [
              { name: "region_code", dataType: "text" },
              { name: "region_name", dataType: "text" },
              { name: "country", dataType: "text" },
            ],
            rowCount: 6,
            rowGenerationHint: "region",
          },
        },
      ],
      rubric: [
        { criterion: "Data accuracy", description: "The clean/merged data is actually correct — no dropped or duplicated orders.", weight: 30 },
        { criterion: "Analysis quality", description: "The real driver is correctly isolated, not just correlated with something else.", weight: 25 },
        { criterion: "Insight quality", description: "The recommendation is specific and actionable, not a generic observation.", weight: 25 },
        { criterion: "Communication", description: "A non-technical manager could read this and know what to do next.", weight: 20 },
      ],
      submissionRequirements: [
        { label: "Analysis workbook", inputMode: "file", artifactKind: "spreadsheet", required: true, acceptedFormats: [".xlsx"], maxFileSizeBytes: 10 * 1024 * 1024 },
        { label: "Recommendation report", inputMode: "file", artifactKind: "pdf", required: true, acceptedFormats: [".pdf"], maxFileSizeBytes: 10 * 1024 * 1024 },
        { label: "Additional notes", inputMode: "text", artifactKind: "text_response", required: false },
      ],
    },
  },
  {
    role: "UI/UX Design Intern",
    department: "Design",
    shortDescription: "Redesign a checkout flow that's losing real customers, and defend your decisions.",
    description:
      "Work with the product design team on a checkout flow with a known drop-off problem. You'll be given the current flow's pain points and a product brief, and asked to design — and justify — a better version.",
    whatYouWillLearn: "How to turn a vague usability complaint into a specific design decision you can defend to a product manager.",
    requirements: ["Diagnose the real usability problems in the current flow", "Redesign the flow with a clear rationale", "Present your work the way you would to a design review"],
    skills: ["UI Design", "UX Research", "Figma", "Interaction Design"],
    duration: "6 weeks",
    hoursPerWeek: 15,
    location: "Doha, Qatar",
    workMode: "hybrid",
    applicationDeadline: daysFromNow(18),
    challenge: {
      title: "Checkout Flow Redesign",
      scenario:
        "A fictional e-commerce company's checkout flow has a 41% cart-abandonment rate at the payment step. You've been given the product brief and a written walkthrough of the current flow, and asked to redesign it — with reasoning the design lead can actually evaluate, not just a prettier screen.",
      estimatedMinutes: 120,
      estimatedDurationLabel: "1.5–2 hours",
      skills: ["UI Design", "UX Research", "Figma", "Interaction Design"],
      tasks: [
        { title: "Identify the UX problems", description: "Read the current-flow walkthrough and product brief, and name the specific points in the flow most likely causing drop-off — not a generic 'the UI feels dated'." },
        { title: "Redesign the workflow", description: "Redesign the checkout flow in Figma, addressing the specific problems you identified." },
        { title: "Explain your decisions", description: "Write a short rationale connecting each major design change back to the specific problem it solves." },
      ],
      files: [
        {
          name: "product_brief.pdf",
          description: "Product brief: target users, business goal, and constraints for the checkout redesign.",
          resourceType: "file",
          artifactKind: "pdf",
          contentSpec: {
            kind: "document",
            title: "Checkout Redesign — Product Brief",
            sections: [
              { heading: "Business goal", paragraphs: ["Reduce cart abandonment at the payment step from 41% to under 25% within one quarter of shipping the redesign."] },
              { heading: "Target users", paragraphs: ["Mobile-first shoppers aged 22–40 who browse on mobile but frequently switch to desktop to actually complete a purchase."] },
              { heading: "Constraints", paragraphs: ["Must keep the existing payment provider integration.", "Must support both guest checkout and signed-in checkout without diverging into two separate flows."] },
            ],
          },
        },
        {
          name: "existing_flow_notes.pdf",
          description: "A written walkthrough of the current checkout flow and where users report friction — a substitute for real screenshots, which aren't available for this synthetic challenge.",
          resourceType: "file",
          artifactKind: "document",
          contentSpec: {
            kind: "document",
            title: "Current Checkout Flow — Walkthrough Notes",
            sections: [
              { heading: "Step 1: Cart review", paragraphs: ["Shows line items and a subtotal only — shipping and tax are not shown until step 3, which support tickets say feels like a 'hidden cost' surprise."] },
              { heading: "Step 2: Shipping address", paragraphs: ["A single long form with 11 fields and no autofill hints; mobile users report it as the single most abandoned step."] },
              { heading: "Step 3: Payment", paragraphs: ["Shipping and tax finally appear here, changing the total shown in step 1 — this is the step with the highest recorded drop-off."] },
            ],
          },
        },
      ],
      rubric: [
        { criterion: "Problem understanding", description: "Correctly identifies the specific friction points, not just general complaints.", weight: 20 },
        { criterion: "Usability reasoning", description: "Each design change is justified by a real usability principle or the stated problem.", weight: 25 },
        { criterion: "Design consistency", description: "The redesigned flow is internally consistent — not disconnected screens.", weight: 20 },
        { criterion: "Execution quality", description: "The Figma file is legible and complete enough to actually evaluate.", weight: 20 },
        { criterion: "Rationale", description: "The written explanation is clear and specific, not vague design-speak.", weight: 15 },
      ],
      submissionRequirements: [
        { label: "Figma design file", inputMode: "url", artifactKind: "figma", required: true, providers: ["figma.com"] },
        { label: "Written rationale", inputMode: "text", artifactKind: "text_response", required: true },
      ],
    },
  },
  {
    role: "Marketing Intern",
    department: "Marketing",
    shortDescription: "Plan a real product-launch campaign, from audience to channel strategy.",
    description:
      "Support the marketing team on the launch of a new (fictional) product. You'll define who the campaign should target, draft real sample content, and explain which channels you'd use and why.",
    whatYouWillLearn: "How to turn a product brief and audience data into an actual campaign plan, not just a mood board.",
    requirements: ["Define a specific target audience from real data", "Draft real sample campaign content", "Justify a channel strategy with reasoning, not guesses"],
    skills: ["Marketing Strategy", "Content Writing", "Audience Research"],
    duration: "8 weeks",
    hoursPerWeek: 20,
    location: "Al Rayyan, Qatar",
    workMode: "onsite",
    applicationDeadline: daysFromNow(25),
    challenge: {
      title: "Product Launch Campaign",
      scenario:
        "A fictional consumer brand is launching a new product next quarter. You've been asked to turn the campaign brief and audience data into a real campaign plan the marketing team could actually pitch internally.",
      estimatedMinutes: 90,
      estimatedDurationLabel: "1–1.5 hours",
      skills: ["Marketing Strategy", "Content Writing", "Audience Research"],
      tasks: [
        { title: "Define the campaign direction", description: "Use audience_data.csv to define a specific target segment, not 'everyone 18–35'." },
        { title: "Create sample content", description: "Write real sample copy for at least two pieces of launch content aimed at your defined segment." },
        { title: "Explain channel strategy", description: "State which channels you'd use and why, backed by the engagement data provided." },
      ],
      files: [
        {
          name: "campaign_brief.pdf",
          description: "The product and campaign brief from the brand team.",
          resourceType: "file",
          artifactKind: "pdf",
          contentSpec: {
            kind: "document",
            title: "Product Launch — Campaign Brief",
            sections: [
              { heading: "Product", paragraphs: ["A reusable insulated water bottle line launching in three colors, priced at a premium versus mass-market competitors."] },
              { heading: "Goal", paragraphs: ["Drive awareness and pre-orders in the four weeks before launch, without a paid media budget above what's already allocated to organic and influencer channels."] },
            ],
          },
        },
        {
          name: "audience_data.csv",
          description: "Engagement data across audience segments and platforms from a recent brand survey.",
          resourceType: "file",
          artifactKind: "dataset",
          contentSpec: {
            kind: "spreadsheet",
            columns: [
              { name: "age_group", dataType: "text" },
              { name: "platform", dataType: "text" },
              { name: "interest", dataType: "text" },
              { name: "engagement_rate", dataType: "number" },
            ],
            rowCount: 20,
            rowGenerationHint: "segment",
          },
        },
      ],
      rubric: [
        { criterion: "Audience understanding", description: "The target segment is specific and backed by the provided data.", weight: 20 },
        { criterion: "Strategy", description: "The channel strategy follows from the data, not from habit.", weight: 25 },
        { criterion: "Creativity", description: "The sample content is distinctive, not generic ad copy.", weight: 20 },
        { criterion: "Execution", description: "The content and plan are complete enough to actually run with.", weight: 20 },
        { criterion: "Communication", description: "The plan is written the way it would be pitched internally.", weight: 15 },
      ],
      submissionRequirements: [
        { label: "Campaign plan", inputMode: "file", artifactKind: "pdf", required: true, acceptedFormats: [".pdf", ".pptx"], maxFileSizeBytes: 15 * 1024 * 1024 },
        { label: "Sample content", inputMode: "text", artifactKind: "text_response", required: true },
        { label: "Supporting link or media", inputMode: "url", artifactKind: "generic_link", required: false },
      ],
    },
  },
  {
    role: "Software Engineering Intern",
    department: "Engineering",
    shortDescription: "Ship a real feature against a written spec, with tests and a technical writeup.",
    description:
      "Implement a real feature against a written technical spec, add tests for it, and explain your approach the way you would in a pull request description.",
    whatYouWillLearn: "How to scope, implement, and document a feature the way a real engineering team expects — not just make code that runs.",
    requirements: ["Implement the feature described in requirements.md", "Add real tests for it", "Document your approach and tradeoffs"],
    skills: ["Software Engineering", "Testing", "Technical Writing"],
    duration: "10 weeks",
    hoursPerWeek: 20,
    location: "Doha, Qatar",
    workMode: "remote",
    applicationDeadline: daysFromNow(28),
    challenge: {
      title: "Fix & Extend the Internship Tracker API",
      scenario:
        "You're contributing to a small internal API used to track internship applications. Product has asked for one specific improvement, described in the attached requirements document — implement it properly, the way you would on a real team, not just make it technically work.",
      estimatedMinutes: 150,
      estimatedDurationLabel: "2–2.5 hours",
      skills: ["Software Engineering", "Testing", "Technical Writing"],
      tasks: [
        { title: "Implement the feature", description: "Implement the change described in requirements.md in a repository of your choice (a new repo is fine — you don't need our exact codebase)." },
        { title: "Add tests", description: "Add real automated tests that would actually fail if the feature were removed or broken." },
        { title: "Document your approach", description: "Write a short technical explanation of your approach and any tradeoffs you made." },
      ],
      files: [
        {
          name: "requirements.md",
          description: "The written technical spec for the feature to implement.",
          resourceType: "file",
          artifactKind: "document",
          contentSpec: {
            kind: "document",
            title: "Feature Requirement — Paginated Applications Endpoint",
            sections: [
              { heading: "Problem", paragraphs: ["The internship-applications listing endpoint currently returns every row with no limit, which breaks once a company has more than a few hundred applicants."] },
              { heading: "Requirement", paragraphs: ["Add `page` and `pageSize` query parameters to the applications listing endpoint, defaulting to page 1 and a page size of 20, capped at 100.", "Return the total count alongside the page of results so the client can render pagination controls."] },
              { heading: "Acceptance criteria", paragraphs: ["An invalid page or pageSize value returns a clear 400 error, not a crash.", "Requesting a page past the last one returns an empty result, not an error."] },
            ],
          },
        },
      ],
      rubric: [
        { criterion: "Correctness", description: "The feature actually satisfies the requirement and its acceptance criteria.", weight: 30 },
        { criterion: "Code quality", description: "The implementation is readable and reasonably structured.", weight: 20 },
        { criterion: "Architecture", description: "The change fits the rest of the system without unnecessary complexity.", weight: 20 },
        { criterion: "Tests", description: "Tests genuinely exercise the new behavior, including at least one edge case.", weight: 15 },
        { criterion: "Requirement coverage", description: "Every stated acceptance criterion is actually addressed.", weight: 15 },
      ],
      submissionRequirements: [
        { label: "Repository link", inputMode: "url", artifactKind: "code_repository", required: true, providers: ["github.com", "gitlab.com"] },
        { label: "Technical explanation", inputMode: "text", artifactKind: "text_response", required: true },
      ],
    },
  },
  {
    role: "Finance & Business Analyst Intern",
    department: "Finance",
    shortDescription: "Build a real financial model for a startup and defend its assumptions.",
    description:
      "Build a runway and pricing model for a fictional early-stage startup using its financials and stated assumptions, then write a memo recommending what it should do next.",
    whatYouWillLearn: "How to build a financial model that survives being questioned, not just one that produces a chart.",
    requirements: ["Build a real financial model from the provided data", "State and defend your assumptions explicitly", "Write a clear recommendation memo"],
    skills: ["Financial Modeling", "Excel", "Business Analysis"],
    duration: "8 weeks",
    hoursPerWeek: 20,
    location: "Lusail, Qatar",
    workMode: "hybrid",
    applicationDeadline: null,
    challenge: {
      title: "Startup Runway & Pricing Model",
      scenario:
        "A fictional early-stage startup has 12 months of financials and a set of stated assumptions about growth and pricing. The founders want a real model of their runway under different pricing scenarios, and a clear recommendation — not just a spreadsheet with numbers in it.",
      estimatedMinutes: 120,
      estimatedDurationLabel: "1.5–2 hours",
      skills: ["Financial Modeling", "Excel", "Business Analysis"],
      tasks: [
        { title: "Build the financial model", description: "Model monthly cash balance and runway using fictional_financials.xlsx and the stated assumptions." },
        { title: "Stress-test the assumptions", description: "Test at least one alternate pricing or growth scenario and show how runway changes." },
        { title: "Write a recommendation memo", description: "Recommend a specific pricing direction, backed by your model, in a memo the founders could actually act on." },
      ],
      files: [
        {
          name: "fictional_financials.xlsx",
          description: "12 months of the startup's historical revenue, costs, and cash balance.",
          resourceType: "file",
          artifactKind: "spreadsheet",
          contentSpec: {
            kind: "spreadsheet",
            columns: [
              { name: "month", dataType: "text" },
              { name: "revenue", dataType: "number" },
              { name: "cogs", dataType: "number" },
              { name: "opex", dataType: "number" },
              { name: "cash_balance", dataType: "number" },
            ],
            rowCount: 12,
            rowGenerationHint: "month",
          },
        },
        {
          name: "assumptions.pdf",
          description: "The founders' stated assumptions about growth, pricing tiers, and churn.",
          resourceType: "file",
          artifactKind: "pdf",
          contentSpec: {
            kind: "document",
            title: "Startup Assumptions",
            sections: [
              { heading: "Growth", paragraphs: ["The founders assume 8% month-over-month revenue growth, driven mostly by upgrades from the free tier."] },
              { heading: "Pricing", paragraphs: ["Two paid tiers exist today: a $19/month tier and a $49/month tier, with roughly 70% of paid customers on the lower tier."] },
              { heading: "Churn", paragraphs: ["Monthly churn is currently assumed at 4%, though the founders admit this number is a guess, not a measurement."] },
            ],
          },
        },
      ],
      rubric: [
        { criterion: "Analytical correctness", description: "The model's math and logic are actually correct.", weight: 25 },
        { criterion: "Assumptions", description: "Assumptions are stated explicitly and reasonably, not hidden in formulas.", weight: 20 },
        { criterion: "Model quality", description: "The model is structured well enough that someone else could follow and adjust it.", weight: 25 },
        { criterion: "Reasoning", description: "The scenario comparison is genuinely informative, not cosmetic.", weight: 15 },
        { criterion: "Recommendation clarity", description: "The memo gives one clear, defensible recommendation.", weight: 15 },
      ],
      submissionRequirements: [
        { label: "Financial model", inputMode: "file", artifactKind: "spreadsheet", required: true, acceptedFormats: [".xlsx"], maxFileSizeBytes: 10 * 1024 * 1024 },
        { label: "Recommendation memo", inputMode: "file", artifactKind: "pdf", required: true, acceptedFormats: [".pdf"], maxFileSizeBytes: 10 * 1024 * 1024 },
      ],
    },
  },
];

interface LegacyUpgrade {
  opportunityId: string;
  /** Same real criteria the pre-existing version already had — weight made
   * first-class (some had it embedded as "(30%)" text; that's parsed and
   * stripped, never re-invented). */
  rubric: { criterion: string; description: string; weight: number }[];
  submissionRequirements: Omit<SubmissionRequirement, "id">[];
  /** Resources to actually generate — same names/descriptions the version
   * already claimed (or, where it claimed none, the real files its own
   * tasks reference), now backed by real bytes instead of nothing. */
  files: SeedFile[];
}

/** Every pre-P0 opportunity that had real applications attached, upgraded
 * to a complete new-model challenge: same real scenario/task text, now with
 * real generated resources and real submission requirements. */
const LEGACY_UPGRADES: LegacyUpgrade[] = [
  {
    // Operations Consultant Intern — "Operational Efficiency & Waste Reduction Simulation"
    opportunityId: "6a0aff02-1824-444c-ba53-062b3943e7e7",
    rubric: [
      { criterion: "Bottleneck Identification Accuracy", description: "Ability to correctly identify the slowest points in the process based on the provided data.", weight: 30 },
      { criterion: "Workflow Optimization Logic", description: "The proposed redesign logically removes waste and reduces steps without compromising quality.", weight: 30 },
      { criterion: "Resource Allocation Efficiency", description: "The plan effectively redistributes staff or machinery to minimize idle time.", weight: 20 },
      { criterion: "Quantitative Justification", description: "The cost-benefit analysis uses the provided data to make realistic, evidence-based projections.", weight: 20 },
    ],
    submissionRequirements: [
      { label: "Optimized process flowchart", inputMode: "file", artifactKind: "document", required: true, acceptedFormats: [".pdf", ".png", ".jpg"] },
      { label: "Waste analysis spreadsheet", inputMode: "file", artifactKind: "spreadsheet", required: true, acceptedFormats: [".xlsx"] },
      { label: "Executive summary recommendation", inputMode: "file", artifactKind: "pdf", required: true, acceptedFormats: [".pdf"] },
    ],
    files: [
      {
        name: "Current_State_Workflow.pdf",
        description: "A detailed description of the existing step-by-step operational process including timestamps for each stage.",
        resourceType: "file",
        artifactKind: "document",
        contentSpec: {
          kind: "document",
          title: "Current State Workflow",
          sections: [
            { heading: "Stage 1: Intake", paragraphs: ["Orders enter the queue and wait for manual review before routing to production."] },
            { heading: "Stage 2: Production", paragraphs: ["Units move through three workstations in sequence, with a recorded average dwell time at each."] },
            { heading: "Stage 3: Quality check", paragraphs: ["A sample of units is inspected before shipment; failed units are routed back to Stage 2."] },
          ],
        },
      },
      {
        name: "Quality_Control_Logs.xlsx",
        description: "Synthetic data showing error rates, rejected units, and the specific steps where quality failures occur.",
        resourceType: "file",
        artifactKind: "spreadsheet",
        contentSpec: {
          kind: "spreadsheet",
          columns: [
            { name: "batch_id", dataType: "text" },
            { name: "stage", dataType: "text" },
            { name: "units_produced", dataType: "number" },
            { name: "units_rejected", dataType: "number" },
          ],
          rowCount: 24,
          rowGenerationHint: "batch",
        },
      },
      {
        name: "Resource_Utilization_Report.csv",
        description: "A log of machinery uptime, staff hours per shift, and idle time percentages across three production lines.",
        resourceType: "file",
        artifactKind: "dataset",
        contentSpec: {
          kind: "spreadsheet",
          columns: [
            { name: "production_line", dataType: "text" },
            { name: "shift", dataType: "text" },
            { name: "uptime_pct", dataType: "number" },
            { name: "idle_pct", dataType: "number" },
          ],
          rowCount: 18,
          rowGenerationHint: "shift",
        },
      },
    ],
  },
  {
    // Data Analyst Intern — "Warehouse Delay Investigation"
    opportunityId: "05b21031-2caa-45f2-b81c-b9dcc9348edb",
    rubric: [
      { criterion: "Root cause accuracy", description: "Correctly narrows the delay to a specific stage using the data", weight: 55 },
      { criterion: "Clarity of recommendation", description: "Recommendation is concrete and actionable, not generic", weight: 45 },
    ],
    submissionRequirements: [
      { label: "Written analysis", inputMode: "text", artifactKind: "text_response", required: true },
      { label: "Supporting chart or table", inputMode: "file", artifactKind: "document", required: false, acceptedFormats: [".pdf", ".png", ".xlsx"] },
    ],
    files: [
      {
        name: "shipment_log.csv",
        description: "Synthetic shipment records for the past month",
        resourceType: "file",
        artifactKind: "dataset",
        contentSpec: {
          kind: "spreadsheet",
          columns: [
            { name: "shipment_id", dataType: "text" },
            { name: "warehouse_stage", dataType: "text" },
            { name: "scheduled_date", dataType: "date" },
            { name: "actual_date", dataType: "date" },
          ],
          rowCount: 30,
          rowGenerationHint: "shipment",
        },
      },
    ],
  },
  {
    // Marketing Intern — "Product Launch Campaign Brief"
    opportunityId: "e8fe166a-2315-4e7f-9679-9f20d2891981",
    rubric: [
      { criterion: "Audience clarity", description: "Target audience is specific, not generic", weight: 50 },
      { criterion: "Concept quality", description: "Post concepts are concrete and on-brand", weight: 50 },
    ],
    submissionRequirements: [
      { label: "Campaign brief", inputMode: "text", artifactKind: "text_response", required: true },
      { label: "Draft post concepts", inputMode: "text", artifactKind: "text_response", required: true },
    ],
    files: [],
  },
  {
    // Customer Success Intern — "Customer Onboarding Review"
    opportunityId: "fa4fb679-581c-4e6d-a02b-58a788863dc5",
    rubric: [
      { criterion: "Customer reasoning", description: "Connects the recommendation to actual customer feedback.", weight: 50 },
      { criterion: "Practicality", description: "Suggests an improvement the team can implement.", weight: 50 },
    ],
    submissionRequirements: [
      { label: "Feedback analysis", inputMode: "text", artifactKind: "text_response", required: true },
      { label: "Onboarding improvement proposal", inputMode: "text", artifactKind: "text_response", required: true },
    ],
    files: [],
  },
  {
    // Product Operations Intern — "Feature Request Workflow Audit"
    opportunityId: "f5e00c14-6de1-45e4-af87-38efcafa0109",
    rubric: [
      { criterion: "Process analysis", description: "Identifies the real workflow constraint.", weight: 55 },
      { criterion: "Operational clarity", description: "Creates a usable process with clear ownership.", weight: 45 },
    ],
    submissionRequirements: [
      { label: "Workflow map", inputMode: "file", artifactKind: "document", required: true, acceptedFormats: [".pdf", ".png"] },
      { label: "Process improvement memo", inputMode: "text", artifactKind: "text_response", required: true },
    ],
    files: [],
  },
  {
    // Finance Intern — "Sales Data Analyst Intern Challenge: NebulaNova Galactic Supplies"
    opportunityId: "d14cb440-c5ae-44d2-854d-8161d9bd1f37",
    rubric: [
      { criterion: "Data Integrity", description: "Did the candidate successfully remove duplicates and standardize dates without losing valid records?", weight: 25 },
      { criterion: "Technical Proficiency", description: "Correct use of joins/lookups and accurate calculation of revenue and profit margins.", weight: 25 },
      { criterion: "Analytical Insight", description: "Did the candidate identify the specific cause of the dip?", weight: 30 },
      { criterion: "Communication", description: "Are the charts easy to read and the recommendations professional, concise, and based on the data?", weight: 20 },
    ],
    submissionRequirements: [
      { label: "Cleaned sales data", inputMode: "file", artifactKind: "spreadsheet", required: true, acceptedFormats: [".xlsx", ".csv"] },
      { label: "Analysis dashboard", inputMode: "file", artifactKind: "spreadsheet", required: true, acceptedFormats: [".xlsx"] },
      { label: "Executive summary", inputMode: "file", artifactKind: "pdf", required: true, acceptedFormats: [".pdf"] },
    ],
    files: [
      {
        name: "brief.pdf",
        description: "Detailed instructions and business context for the NebulaNova revenue dip.",
        resourceType: "file",
        artifactKind: "pdf",
        contentSpec: {
          kind: "document",
          title: "NebulaNova Galactic Supplies — Revenue Dip Brief",
          sections: [
            { heading: "Context", paragraphs: ["NebulaNova Galactic Supplies, a B2B wholesaler of high-tech maintenance equipment for space stations, has noticed a dip in quarterly revenue."] },
            { heading: "Your task", paragraphs: ["Clean the provided raw exports, identify which products or sectors are underperforming, and provide actionable recommendations to the sales leadership team."] },
          ],
        },
      },
      {
        name: "raw_sales_export.csv",
        description: "Synthetic daily transactions with inconsistent dates, duplicates, and missing discount values.",
        resourceType: "file",
        artifactKind: "dataset",
        contentSpec: {
          kind: "spreadsheet",
          columns: [
            { name: "order_id", dataType: "text" },
            { name: "product_id", dataType: "text" },
            { name: "sales_rep_id", dataType: "text" },
            { name: "revenue", dataType: "number" },
            { name: "discount", dataType: "number" },
            { name: "order_date", dataType: "date" },
          ],
          rowCount: 50,
          rowGenerationHint: "order",
        },
      },
      {
        name: "product_catalog.csv",
        description: "Synthetic lookup table mapping ProductIDs to Categories and Unit Costs.",
        resourceType: "file",
        artifactKind: "dataset",
        contentSpec: {
          kind: "spreadsheet",
          columns: [
            { name: "product_id", dataType: "text" },
            { name: "category", dataType: "text" },
            { name: "unit_cost", dataType: "number" },
          ],
          rowCount: 15,
          rowGenerationHint: "product",
        },
      },
      {
        name: "region_mapping.csv",
        description: "Synthetic mapping of SalesRepIDs to Galactic Sectors.",
        resourceType: "file",
        artifactKind: "dataset",
        contentSpec: {
          kind: "spreadsheet",
          columns: [
            { name: "sales_rep_id", dataType: "text" },
            { name: "sector", dataType: "text" },
          ],
          rowCount: 8,
          rowGenerationHint: "rep",
        },
      },
    ],
  },
];

/** Mirrors persistChallengeResources in src/lib/opportunities/actions.ts —
 * duplicated here (not imported; that function is a private module-local
 * helper) because a seed script legitimately bypasses the auth-gated
 * server action layer, the same way every other script in this repo does. */
async function persistSeedResources(versionId: string, files: SeedFile[]) {
  const db = getDb();
  const admin = createAdminClient();
  const rows: (typeof schema.challengeResources.$inferInsert)[] = [];

  for (const file of files) {
    const generated = await generateResourceFile({ name: file.name, description: file.description, contentSpec: file.contentSpec });
    if (!generated) {
      rows.push({
        challengeVersionId: versionId,
        name: file.name,
        resourceType: file.resourceType,
        artifactKind: file.artifactKind,
        description: file.description,
        contentSpec: file.contentSpec ?? null,
        generationStatus: "requires_upload",
      });
      continue;
    }
    const resourceId = crypto.randomUUID();
    const extension = file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? "";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${versionId}/${resourceId}-${safeName}`;
    const { error } = await admin.storage.from("challenge-resources").upload(storagePath, generated.buffer, { contentType: generated.mimeType, upsert: false });
    rows.push({
      id: resourceId,
      challengeVersionId: versionId,
      name: file.name,
      resourceType: file.resourceType,
      artifactKind: file.artifactKind,
      mimeType: generated.mimeType,
      fileExtension: extension,
      storagePath: error ? null : storagePath,
      sizeBytes: generated.buffer.byteLength,
      description: file.description,
      contentSpec: file.contentSpec ?? null,
      generationStatus: error ? "failed" : "ready",
    });
    if (error) console.error(`  ! upload failed for "${file.name}": ${error.message}`);
  }

  if (rows.length) await db.insert(schema.challengeResources).values(rows);
}

async function createDemoStudent(db: ReturnType<typeof getDb>, fullName: string, major: string, university: string) {
  const [user] = await db
    .insert(schema.users)
    .values({
      authUserId: crypto.randomUUID(),
      email: `demo.${fullName.toLowerCase().replace(/[^a-z]+/g, ".")}.${Date.now()}.${Math.floor(Math.random() * 1000)}@example.com`,
      role: "student",
      fullName,
    })
    .returning();
  await db.insert(schema.studentProfiles).values({
    userId: user.id,
    educationStage: "university",
    university,
    major,
    graduationYear: 2027,
    location: "Doha",
    interests: ["Internship"],
    opportunityTypes: ["Internship"],
    skills: [],
    availability: "20 hours/week",
  });
  return user;
}

async function main() {
  const db = getDb();

  const [company] = await db.select().from(schema.companies).limit(1);
  if (!company) {
    console.error("No company found — sign up as a company first, then re-run this script.");
    process.exit(1);
  }
  console.log(`Using company: ${company.name} (${company.id})`);

  // --- 1. Remove clearly-identified junk fixtures ---------------------------
  const junk = await db
    .select({ id: schema.opportunities.id, role: schema.opportunities.role, location: schema.opportunities.location })
    .from(schema.opportunities)
    .where(or(eq(schema.opportunities.location, "Remote"), eq(schema.opportunities.location, "Not set yet"), eq(schema.opportunities.duration, "Not set yet")));
  if (junk.length) {
    await db.delete(schema.opportunities).where(inArray(schema.opportunities.id, junk.map((j) => j.id)));
    console.log(`Removed ${junk.length} junk opportunity row(s): ${junk.map((j) => `${j.role} (${j.location})`).join(", ")}`);
  } else {
    console.log("No junk location fixtures found.");
  }

  // A draft with zero applications and no challenge at all is pure dead
  // weight — nothing downstream depends on it (never shown in Explore
  // since it's a draft, and no candidate/submission references it).
  const deadDrafts = await db
    .select({ id: schema.opportunities.id, role: schema.opportunities.role })
    .from(schema.opportunities)
    .where(eq(schema.opportunities.status, "draft"));
  for (const draft of deadDrafts) {
    const [hasApp] = await db.select({ id: schema.applications.id }).from(schema.applications).where(eq(schema.applications.opportunityId, draft.id)).limit(1);
    const [hasChallenge] = await db.select({ id: schema.challenges.id }).from(schema.challenges).where(eq(schema.challenges.opportunityId, draft.id)).limit(1);
    if (!hasApp && !hasChallenge) {
      await db.delete(schema.opportunities).where(eq(schema.opportunities.id, draft.id));
      console.log(`Removed dead draft opportunity: ${draft.role} (0 applications, no challenge)`);
    }
  }

  // --- 2. Delete-then-recreate this script's own tagged opportunities -------
  const existing = await db
    .select({ id: schema.opportunities.id })
    .from(schema.opportunities)
    .where(inArray(schema.opportunities.department, [...SEED_DEPARTMENTS]));
  if (existing.length) {
    await db.delete(schema.opportunities).where(inArray(schema.opportunities.id, existing.map((o) => o.id)));
    console.log(`Cleared ${existing.length} previously-seeded opportunity row(s) for a clean reseed.`);
  }

  const opportunityIdByDepartment = new Map<string, string>();
  const versionIdByDepartment = new Map<string, string>();
  const requirementsByDepartment = new Map<string, SubmissionRequirement[]>();

  for (const item of SEED_OPPORTUNITIES) {
    const [opportunity] = await db
      .insert(schema.opportunities)
      .values({
        companyId: company.id,
        role: item.role,
        department: item.department,
        shortDescription: item.shortDescription,
        description: item.description,
        whatYouWillLearn: item.whatYouWillLearn,
        requirements: item.requirements,
        duration: item.duration,
        hoursPerWeek: item.hoursPerWeek,
        location: item.location,
        workMode: item.workMode,
        applicationDeadline: item.applicationDeadline,
        skills: item.skills,
        status: "published",
      })
      .returning();

    const submissionRequirements: SubmissionRequirement[] = item.challenge.submissionRequirements.map((r) => ({ ...r, id: reqId() }));
    const tasks = item.challenge.tasks.map((t) => ({ id: taskId(), title: t.title, description: t.description }));

    const [challenge] = await db.insert(schema.challenges).values({ opportunityId: opportunity.id, status: "published" }).returning();
    const [version] = await db
      .insert(schema.challengeVersions)
      .values({
        challengeId: challenge.id,
        versionNumber: 1,
        source: "approved",
        title: item.challenge.title,
        scenario: item.challenge.scenario,
        estimatedMinutes: item.challenge.estimatedMinutes,
        estimatedDurationLabel: item.challenge.estimatedDurationLabel,
        skills: item.challenge.skills,
        tasks,
        deliverables: submissionRequirements.map((r) => r.label),
        files: item.challenge.files.map((f) => ({ name: f.name, description: f.description, resourceType: f.resourceType, artifactKind: f.artifactKind, contentSpec: f.contentSpec ?? null })),
        rubric: item.challenge.rubric,
        submissionRequirements,
      })
      .returning();
    await db.update(schema.challenges).set({ currentVersionId: version.id }).where(eq(schema.challenges.id, challenge.id));

    console.log(`Generating ${item.challenge.files.length} resource file(s) for "${item.role}"...`);
    await persistSeedResources(version.id, item.challenge.files);

    opportunityIdByDepartment.set(item.department, opportunity.id);
    versionIdByDepartment.set(item.department, version.id);
    requirementsByDepartment.set(item.department, submissionRequirements);
    console.log(`Created opportunity: ${item.role} (${opportunity.id})`);
  }

  // --- 3. Upgrade every remaining pre-P0 opportunity to the new model -------
  for (const upgrade of LEGACY_UPGRADES) {
    const [challenge] = await db.select().from(schema.challenges).where(eq(schema.challenges.opportunityId, upgrade.opportunityId));
    if (!challenge?.currentVersionId) {
      console.log(`Skipped legacy upgrade for ${upgrade.opportunityId} — no challenge/version found.`);
      continue;
    }
    const [currentVersion] = await db.select().from(schema.challengeVersions).where(eq(schema.challengeVersions.id, challenge.currentVersionId));
    if (!currentVersion) continue;
    if (currentVersion.submissionRequirements.length > 0) {
      console.log(`"${currentVersion.title}" already upgraded — skipping.`);
      continue;
    }

    const submissionRequirements: SubmissionRequirement[] = upgrade.submissionRequirements.map((r) => ({ ...r, id: reqId() }));
    const [newVersion] = await db
      .insert(schema.challengeVersions)
      .values({
        challengeId: challenge.id,
        versionNumber: currentVersion.versionNumber + 1,
        source: "approved",
        title: currentVersion.title,
        scenario: currentVersion.scenario,
        estimatedMinutes: currentVersion.estimatedMinutes,
        estimatedDurationLabel: currentVersion.estimatedDurationLabel,
        skills: currentVersion.skills,
        tasks: currentVersion.tasks,
        deliverables: submissionRequirements.map((r) => r.label),
        files: upgrade.files.map((f) => ({ name: f.name, description: f.description, resourceType: f.resourceType, artifactKind: f.artifactKind, contentSpec: f.contentSpec ?? null })),
        rubric: upgrade.rubric,
        submissionRequirements,
      })
      .returning();
    await db.update(schema.challenges).set({ currentVersionId: newVersion.id, status: "published" }).where(eq(schema.challenges.id, challenge.id));

    console.log(`Generating ${upgrade.files.length} resource file(s) for "${currentVersion.title}"...`);
    await persistSeedResources(newVersion.id, upgrade.files);
    console.log(`Upgraded "${currentVersion.title}" to the new challenge model (v${newVersion.versionNumber}).`);
  }

  // --- 4. Demo students covering every real application/challenge state -----
  // Deterministic re-run: a prior run's demo students would otherwise sit
  // as orphaned users forever (their applications cascade-deleted along
  // with the tagged opportunities in step 2, but the user rows themselves
  // don't cascade from that). Clear the exact 6 fixed identities first.
  const DEMO_STUDENT_NAMES = ["Amal Al-Kuwari", "Youssef Al-Emadi", "Mariam Al-Sulaiti", "Omar Al-Mannai", "Layla Al-Thani", "Khalid Al-Marri"];
  const priorDemoStudents = await db.select({ id: schema.users.id }).from(schema.users).where(inArray(schema.users.fullName, DEMO_STUDENT_NAMES));
  if (priorDemoStudents.length) {
    await db.delete(schema.users).where(inArray(schema.users.id, priorDemoStudents.map((u) => u.id)));
    console.log(`Cleared ${priorDemoStudents.length} previously-seeded demo student(s) for a clean reseed.`);
  }

  const dataOppId = opportunityIdByDepartment.get("Data & Analytics")!;
  const dataVersionId = versionIdByDepartment.get("Data & Analytics")!;
  const dataReqs = requirementsByDepartment.get("Data & Analytics")!;
  const designOppId = opportunityIdByDepartment.get("Design")!;
  const designVersionId = versionIdByDepartment.get("Design")!;
  const designReqs = requirementsByDepartment.get("Design")!;
  const marketingOppId = opportunityIdByDepartment.get("Marketing")!;
  const engineeringOppId = opportunityIdByDepartment.get("Engineering")!;

  // State 1: application created, challenge not started.
  const amal = await createDemoStudent(db, "Amal Al-Kuwari", "Business Analytics", "Qatar University");
  await db.insert(schema.applications).values({ opportunityId: dataOppId, studentId: amal.id, status: "applied", source: "direct" });
  console.log(`Seeded "to do" state: ${amal.fullName} -> Data Analyst Intern`);

  // State 2: challenge in progress (started, not submitted).
  const youssef = await createDemoStudent(db, "Youssef Al-Emadi", "Statistics", "Carnegie Mellon Qatar");
  await db.insert(schema.applications).values({ opportunityId: dataOppId, studentId: youssef.id, status: "applied", source: "direct", challengeStartedAt: new Date() });
  console.log(`Seeded "in progress" state: ${youssef.fullName} -> Data Analyst Intern`);

  // State 3: challenge submitted, with a real multi-artifact submission.
  const mariam = await createDemoStudent(db, "Mariam Al-Sulaiti", "Finance", "Qatar University");
  const [mariamApp] = await db
    .insert(schema.applications)
    .values({ opportunityId: dataOppId, studentId: mariam.id, status: "applied", source: "direct", challengeStartedAt: daysFromNow(-2) })
    .returning();
  const analysisNotes =
    "The underperformance is concentrated in Region 3, driven almost entirely by the Home & Kitchen category, not by an across-the-board slowdown as the initial theory suggested.";
  const workbookFile = await generateResourceFile({
    name: "analysis.xlsx",
    description: "Cleaned and merged sales analysis workbook",
    contentSpec: { kind: "spreadsheet", columns: [{ name: "region", dataType: "text" }, { name: "category", dataType: "text" }, { name: "revenue", dataType: "number" }], rowCount: 12 },
  });
  const reportFile = await generateResourceFile({
    name: "recommendation.pdf",
    description: "Recommendation report",
    contentSpec: { kind: "document", title: "Sales Recommendation", sections: [{ heading: "Finding", paragraphs: [analysisNotes] }] },
  });
  const admin = createAdminClient();
  const [mariamSubmission] = await db
    .insert(schema.submissions)
    .values({ applicationId: mariamApp.id, challengeVersionId: dataVersionId, aiUsageMode: "ai_allowed", status: "submitted", notes: analysisNotes })
    .returning();
  const submissionArtifactRows: (typeof schema.submissionArtifacts.$inferInsert)[] = [];
  if (workbookFile) {
    const path = `${mariamApp.id}/${crypto.randomUUID()}-analysis.xlsx`;
    const { error } = await admin.storage.from("submission-artifacts").upload(path, workbookFile.buffer, { contentType: workbookFile.mimeType });
    if (!error) {
      submissionArtifactRows.push({
        submissionId: mariamSubmission.id,
        requirementId: dataReqs[0].id,
        inputMode: "file",
        artifactKind: "spreadsheet",
        label: dataReqs[0].label,
        originalFilename: "analysis.xlsx",
        mimeType: workbookFile.mimeType,
        sizeBytes: workbookFile.buffer.byteLength,
        storagePath: path,
      });
    }
  }
  if (reportFile) {
    const path = `${mariamApp.id}/${crypto.randomUUID()}-recommendation.pdf`;
    const { error } = await admin.storage.from("submission-artifacts").upload(path, reportFile.buffer, { contentType: reportFile.mimeType });
    if (!error) {
      submissionArtifactRows.push({
        submissionId: mariamSubmission.id,
        requirementId: dataReqs[1].id,
        inputMode: "file",
        artifactKind: "pdf",
        label: dataReqs[1].label,
        originalFilename: "recommendation.pdf",
        mimeType: reportFile.mimeType,
        sizeBytes: reportFile.buffer.byteLength,
        storagePath: path,
      });
    }
  }
  submissionArtifactRows.push({
    submissionId: mariamSubmission.id,
    requirementId: dataReqs[2].id,
    inputMode: "text",
    artifactKind: "text_response",
    label: dataReqs[2].label,
    textContent: "Time spent: about 3.5 hours, mostly on reconciling region codes between the two files.",
  });
  await db.insert(schema.submissionArtifacts).values(submissionArtifactRows);
  console.log(`Seeded "submitted" state with ${submissionArtifactRows.length} real artifacts: ${mariam.fullName} -> Data Analyst Intern`);

  // State 4: submitted + reviewed, with real candidate_evidence (Structured Evidence UI).
  const omar = await createDemoStudent(db, "Omar Al-Mannai", "Design", "VCU Qatar");
  const [omarApp] = await db
    .insert(schema.applications)
    .values({ opportunityId: designOppId, studentId: omar.id, status: "shortlisted", source: "direct", challengeStartedAt: daysFromNow(-5) })
    .returning();
  const rationaleText =
    "I moved shipping and tax to the cart-review step so the total never changes later, since the walkthrough notes call that out as the highest-drop-off moment. I also split the 11-field address form into two shorter screens with autofill hints, since long forms were flagged as the most abandoned step on mobile.";
  const [omarSubmission] = await db
    .insert(schema.submissions)
    .values({ applicationId: omarApp.id, challengeVersionId: designVersionId, aiUsageMode: "ai_allowed", status: "reviewed", notes: "", submittedAt: daysFromNow(-3) })
    .returning();
  await db.insert(schema.submissionArtifacts).values([
    {
      submissionId: omarSubmission.id,
      requirementId: designReqs[0].id,
      inputMode: "url",
      artifactKind: "figma",
      label: designReqs[0].label,
      externalUrl: "https://www.figma.com/design/demo-checkout-redesign/Checkout-Flow-Redesign",
    },
    {
      submissionId: omarSubmission.id,
      requirementId: designReqs[1].id,
      inputMode: "text",
      artifactKind: "text_response",
      label: designReqs[1].label,
      textContent: rationaleText,
    },
  ]);
  await db.insert(schema.candidateEvidence).values({
    submissionId: omarSubmission.id,
    rubricVersionId: designVersionId,
    tasksCompleted: "3/3 rubric criteria show real evidence",
    timeSpentMinutes: 205,
    aiSummary: "Each major design change is tied back to a specific documented friction point rather than a general design opinion.",
    strength: "Directly ties the total-changes-late problem to moving shipping/tax earlier in the flow.",
    weakness: "Design consistency across the two new address-form screens isn't addressed in the rationale.",
    evidenceSummary: {
      version: 1,
      fingerprint: "seed-fixture",
      generatedAt: new Date().toISOString(),
      sources: [{ id: "artifact-rationale", label: designReqs[1].label, kind: "submission" }],
      highlights: [],
      unavailable: ["Figma design file: requires human review — design tool not accessible for automated analysis."],
      metrics: [
        { criterion: "Problem understanding", level: "strong", rationale: "Names the exact two friction points from the walkthrough notes rather than a generic complaint.", evidenceQuote: "since the walkthrough notes call that out as the highest-drop-off moment", sourceId: "artifact-rationale" },
        { criterion: "Usability reasoning", level: "solid", rationale: "Each change is connected to a stated problem, though the connection to shorter forms could be more explicit.", evidenceQuote: "long forms were flagged as the most abandoned step on mobile", sourceId: "artifact-rationale" },
        { criterion: "Rationale", level: "solid", rationale: "Clear and specific, references the source data directly.", evidenceQuote: undefined, sourceId: undefined },
      ],
      strengths: ["Ties design changes directly to documented friction points, not general design opinions."],
      gaps: ["Design consistency across the new address-form screens isn't addressed in the written rationale — needs human review of the Figma file itself."],
      confidence: "medium",
    },
  });
  console.log(`Seeded "reviewed" state with real candidate_evidence: ${omar.fullName} -> UI/UX Design Intern`);

  // State 5: offer sent (pending).
  const layla = await createDemoStudent(db, "Layla Al-Thani", "Marketing", "Northwestern Qatar");
  const [laylaApp] = await db
    .insert(schema.applications)
    .values({ opportunityId: marketingOppId, studentId: layla.id, status: "invited", source: "direct", challengeStartedAt: daysFromNow(-6) })
    .returning();
  await db.insert(schema.internshipOffers).values({ applicationId: laylaApp.id, status: "pending", placementFeeStatus: "stubbed_paid" });
  console.log(`Seeded "offer sent" state: ${layla.fullName} -> Marketing Intern`);

  // State 6: offer accepted.
  const khalid = await createDemoStudent(db, "Khalid Al-Marri", "Computer Science", "Texas A&M Qatar");
  const [khalidApp] = await db
    .insert(schema.applications)
    .values({ opportunityId: engineeringOppId, studentId: khalid.id, status: "invited", source: "direct", challengeStartedAt: daysFromNow(-10) })
    .returning();
  await db.insert(schema.internshipOffers).values({ applicationId: khalidApp.id, status: "accepted", placementFeeStatus: "stubbed_paid" });
  console.log(`Seeded "offer accepted" state: ${khalid.fullName} -> Software Engineering Intern`);

  console.log("\nDone. Finance & Business Analyst Intern was left with zero applications — use it to test a completely fresh, unapplied opportunity.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
