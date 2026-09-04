import { asc, count, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "../src/db";

/**
 * One-time, guarded normalization for the Skyline Logistics demo workspace.
 *
 * The earlier demo scripts were additive and were run more than once. That
 * left duplicate empty postings and concentrated every visible candidate in
 * two internships. This script keeps every application, submission, file URL,
 * note, event, offer, and internship program, then redistributes the existing
 * records across five unique postings. It refuses to apply if the known demo
 * shape has changed, so it cannot silently rewrite real production data.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/normalize-demo-candidates.ts
 *   node --env-file=.env.local --import tsx scripts/normalize-demo-candidates.ts --apply
 */

type RoleKey = "data" | "marketing" | "customer" | "product" | "finance";

const ROLE_CONFIG: Record<
  RoleKey,
  {
    role: string;
    description: string;
    duration: string;
    hoursPerWeek: number;
    skills: string[];
    major: string;
    availability: string;
    challenge: {
      title: string;
      scenario: string;
      skills: string[];
      tasks: { title: string; description: string }[];
      deliverables: string[];
      rubric: { criterion: string; weight: number; description: string }[];
      submissionRequirements: { id: string; label: string; inputMode: "text"; artifactKind: "text_response"; required: boolean }[];
    };
  }
> = {
  data: {
    role: "Data Analyst Intern",
    description: "Analyze shipment and inventory data to identify operational improvements.",
    duration: "3 months",
    hoursPerWeek: 20,
    skills: ["SQL", "Data Analysis", "Excel", "Power BI"],
    major: "Business Analytics",
    availability: "20 hours/week",
    challenge: {
      title: "Warehouse Delay Investigation",
      scenario: "Analyze a month of shipment records, isolate the main cause of delays, and recommend a practical operational fix.",
      skills: ["SQL", "Data Analysis", "Excel"],
      tasks: [
        { title: "Explore the shipment data", description: "Identify meaningful patterns and anomalies in the supplied records." },
        { title: "Find the root cause", description: "Use the data to isolate the process most associated with delays." },
        { title: "Recommend an action", description: "Propose one concrete response supported by the analysis." },
      ],
      deliverables: ["Root cause analysis", "Operations recommendation memo"],
submissionRequirements: [
        { id: crypto.randomUUID(), label: "Root cause analysis", inputMode: "text" as const, artifactKind: "text_response" as const, required: true },
      ],
      rubric: [
        { criterion: "Analysis", weight: 50, description: "Uses the data accurately and explains the main pattern." },
        { criterion: "Recommendation", weight: 50, description: "Proposes a concrete action tied to the evidence." },
      ],
    },
  },
  marketing: {
    role: "Marketing Intern",
    description: "Support campaign planning, content development, and performance reporting.",
    duration: "2 months",
    hoursPerWeek: 15,
    skills: ["Marketing", "Social Media", "Content Strategy", "Communication"],
    major: "Marketing",
    availability: "15 hours/week",
    challenge: {
      title: "Product Launch Campaign Brief",
      scenario: "Plan a focused social campaign for a new service launch and define how the team should measure it.",
      skills: ["Marketing", "Social Media", "Communication"],
      tasks: [
        { title: "Define the audience", description: "Describe a specific audience and the insight behind the choice." },
        { title: "Develop content concepts", description: "Draft three launch-week post concepts." },
        { title: "Choose a success metric", description: "Select a measurable campaign outcome and explain why it matters." },
      ],
      deliverables: ["Campaign brief", "Three content concepts"],
submissionRequirements: [
        { id: crypto.randomUUID(), label: "Campaign brief", inputMode: "text" as const, artifactKind: "text_response" as const, required: true },
      ],
      rubric: [
        { criterion: "Audience clarity", weight: 50, description: "Defines a specific and relevant audience." },
        { criterion: "Concept quality", weight: 50, description: "Presents concrete, usable campaign ideas." },
      ],
    },
  },
  customer: {
    role: "Customer Success Intern",
    description: "Help improve onboarding, support workflows, and customer health reporting.",
    duration: "3 months",
    hoursPerWeek: 15,
    skills: ["Customer Success", "CRM", "Communication", "Problem Solving"],
    major: "Business Administration",
    availability: "15 hours/week",
    challenge: {
      title: "Customer Onboarding Review",
      scenario: "Review onboarding feedback from new customers and recommend changes that reduce early-stage support issues.",
      skills: ["Customer Success", "CRM", "Communication"],
      tasks: [
        { title: "Group the feedback", description: "Identify the recurring onboarding questions and friction points." },
        { title: "Prioritize one issue", description: "Explain which issue should be addressed first and why." },
        { title: "Draft an improvement", description: "Propose a practical update to the onboarding flow." },
      ],
      deliverables: ["Feedback analysis", "Onboarding improvement proposal"],
submissionRequirements: [
        { id: crypto.randomUUID(), label: "Feedback analysis", inputMode: "text" as const, artifactKind: "text_response" as const, required: true },
      ],
      rubric: [
        { criterion: "Customer reasoning", weight: 50, description: "Connects the recommendation to actual customer feedback." },
        { criterion: "Practicality", weight: 50, description: "Suggests an improvement the team can implement." },
      ],
    },
  },
  product: {
    role: "Product Operations Intern",
    description: "Document product workflows, analyze operational bottlenecks, and coordinate process improvements.",
    duration: "3 months",
    hoursPerWeek: 18,
    skills: ["Operations", "Process Improvement", "Excel", "Project Management"],
    major: "Information Systems",
    availability: "18 hours/week",
    challenge: {
      title: "Feature Request Workflow Audit",
      scenario: "Review a sample feature-request workflow and recommend a clearer process for triage and follow-up.",
      skills: ["Operations", "Process Improvement", "Project Management"],
      tasks: [
        { title: "Map the current workflow", description: "Summarize how requests move from intake to decision." },
        { title: "Identify the bottleneck", description: "Find the step most responsible for delays or unclear ownership." },
        { title: "Design an improvement", description: "Recommend a lightweight workflow the team can adopt." },
      ],
      deliverables: ["Workflow map", "Process improvement memo"],
submissionRequirements: [
        { id: crypto.randomUUID(), label: "Workflow map", inputMode: "text" as const, artifactKind: "text_response" as const, required: true },
      ],
      rubric: [
        { criterion: "Process analysis", weight: 50, description: "Identifies the real workflow constraint." },
        { criterion: "Operational clarity", weight: 50, description: "Creates a usable process with clear ownership." },
      ],
    },
  },
  finance: {
    role: "Finance Intern",
    description: "Support budget tracking, variance analysis, and monthly finance reporting.",
    duration: "3 months",
    hoursPerWeek: 15,
    skills: ["Financial Analysis", "Excel", "Budgeting", "Accounting"],
    major: "Finance",
    availability: "15 hours/week",
    challenge: {
      title: "Monthly Budget Variance Review",
      scenario: "Review a simplified monthly budget, explain the largest variance, and recommend one follow-up action.",
      skills: ["Financial Analysis", "Excel", "Budgeting"],
      tasks: [
        { title: "Calculate the variances", description: "Compare actual spending with the approved budget." },
        { title: "Explain the largest change", description: "Identify the most material variance and its likely driver." },
        { title: "Recommend a follow-up", description: "Propose one practical action for the finance manager." },
      ],
      deliverables: ["Variance analysis", "Finance recommendation memo"],
submissionRequirements: [
        { id: crypto.randomUUID(), label: "Variance analysis", inputMode: "text" as const, artifactKind: "text_response" as const, required: true },
      ],
      rubric: [
        { criterion: "Accuracy", weight: 50, description: "Calculates and interprets the variances correctly." },
        { criterion: "Business judgment", weight: 50, description: "Recommends a proportionate follow-up action." },
      ],
    },
  },
};

const ACTIVE_REVIEW_ROLES: RoleKey[] = ["data", "customer", "marketing", "product", "marketing", "data", "marketing"];
const SHORTLISTED_ROLES: RoleKey[] = ["data", "customer", "product", "data", "marketing"];
const OFFER_SENT_ROLES: RoleKey[] = ["customer", "data", "marketing", "data", "customer", "data", "marketing", "finance", "product"];
const ARCHIVED_ROLES: RoleKey[] = ["data", "marketing", "customer", "product", "finance"];
const PRE_SUBMISSION_ROLES: RoleKey[] = ["data", "marketing", "customer", "product"];

const DUPLICATE_REPLACEMENTS = [
  "Aisha Rahman",
  "Khalid Mansour",
  "Dalia Hassan",
  "Faisal Mahmoud",
  "Salma Darwish",
  "Yusuf Al-Ansari",
  "Ahmed Al-Kuwari",
  "Noor Al-Harbi",
  "Leena Al-Mansoori",
  "Reem Qureshi",
];

function roleDistribution(assignments: { role: RoleKey }[]) {
  return Object.fromEntries(
    (Object.keys(ROLE_CONFIG) as RoleKey[]).map((key) => [ROLE_CONFIG[key].role, assignments.filter((item) => item.role === key).length]),
  );
}

async function main() {
  const apply = process.argv.includes("--apply");
  const db = getDb();
  const [company] = await db
    .select({ id: schema.companies.id, name: schema.companies.name })
    .from(schema.companies)
    .where(eq(schema.companies.slug, "skyline-logistics"))
    .limit(1);

  if (!company) throw new Error("Skyline Logistics not found.");

  const opportunityRows = await db
    .select({
      id: schema.opportunities.id,
      role: schema.opportunities.role,
      createdAt: schema.opportunities.createdAt,
      applications: count(schema.applications.id),
    })
    .from(schema.opportunities)
    .leftJoin(schema.applications, eq(schema.applications.opportunityId, schema.opportunities.id))
    .where(eq(schema.opportunities.companyId, company.id))
    .groupBy(schema.opportunities.id)
    .orderBy(asc(schema.opportunities.createdAt));

  const canonicalOpportunityId = new Map<RoleKey, string>();
  const usedOpportunityIds = new Set<string>();

  function takeOpportunity(key: RoleKey, preferredRoles: string[]) {
    const candidate = opportunityRows.find(
      (row) => !usedOpportunityIds.has(row.id) && preferredRoles.includes(row.role) && (row.applications === 0 || row.role === ROLE_CONFIG[key].role),
    );
    if (!candidate) throw new Error(`No safe existing opportunity is available for ${ROLE_CONFIG[key].role}.`);
    canonicalOpportunityId.set(key, candidate.id);
    usedOpportunityIds.add(candidate.id);
  }

  takeOpportunity("data", [ROLE_CONFIG.data.role]);
  takeOpportunity("marketing", [ROLE_CONFIG.marketing.role]);
  takeOpportunity("customer", [ROLE_CONFIG.customer.role]);
  takeOpportunity("product", [ROLE_CONFIG.product.role, "Sales Data Analyst Intern"]);
  takeOpportunity("finance", [ROLE_CONFIG.finance.role, "Sales Data Analyst Intern"]);

  const opportunityIds = opportunityRows.map((row) => row.id);
  const applications = await db
    .select({
      applicationId: schema.applications.id,
      studentId: schema.applications.studentId,
      status: schema.applications.status,
      appliedAt: schema.applications.createdAt,
      studentName: schema.users.fullName,
      studentEmail: schema.users.email,
      submissionId: schema.submissions.id,
      evidenceId: schema.candidateEvidence.id,
      programId: schema.internshipPrograms.id,
    })
    .from(schema.applications)
    .innerJoin(schema.users, eq(schema.users.id, schema.applications.studentId))
    .leftJoin(schema.submissions, eq(schema.submissions.applicationId, schema.applications.id))
    .leftJoin(schema.candidateEvidence, eq(schema.candidateEvidence.submissionId, schema.submissions.id))
    .leftJoin(schema.internshipOffers, eq(schema.internshipOffers.applicationId, schema.applications.id))
    .leftJoin(schema.internshipPrograms, eq(schema.internshipPrograms.offerId, schema.internshipOffers.id))
    .where(inArray(schema.applications.opportunityId, opportunityIds))
    .orderBy(asc(schema.applications.createdAt));

  const activeReview = applications.filter((row) => row.status === "applied" && row.submissionId);
  const shortlisted = applications.filter((row) => row.status === "shortlisted" && row.submissionId);
  const offerSent = applications.filter((row) => row.status === "invited" && row.submissionId);
  const archived = applications.filter((row) => (row.status === "declined" || row.status === "withdrawn") && row.submissionId);
  const preSubmission = applications.filter((row) => row.status === "applied" && !row.submissionId);

  const expected = [
    ["active review", activeReview.length, ACTIVE_REVIEW_ROLES.length],
    ["shortlisted", shortlisted.length, SHORTLISTED_ROLES.length],
    ["offer sent", offerSent.length, OFFER_SENT_ROLES.length],
    ["archived", archived.length, ARCHIVED_ROLES.length],
    ["pre-submission", preSubmission.length, PRE_SUBMISSION_ROLES.length],
  ] as const;
  for (const [label, actual, required] of expected) {
    if (actual !== required) throw new Error(`Expected ${required} ${label} demo rows, found ${actual}. Refusing to apply.`);
  }

  const assignments = [
    ...activeReview.map((row, index) => ({ row, role: ACTIVE_REVIEW_ROLES[index] })),
    ...shortlisted.map((row, index) => ({ row, role: SHORTLISTED_ROLES[index] })),
    ...offerSent.map((row, index) => ({ row, role: OFFER_SENT_ROLES[index] })),
    ...archived.map((row, index) => ({ row, role: ARCHIVED_ROLES[index] })),
    ...preSubmission.map((row, index) => ({ row, role: PRE_SUBMISSION_ROLES[index] })),
  ];

  const activeAssignments = assignments.filter(({ row }) => row.status === "applied" || row.status === "shortlisted" || row.status === "invited").filter(({ row }) => Boolean(row.submissionId));
  const archivedAssignments = assignments.filter(({ row }) => row.status === "declined" || row.status === "withdrawn");
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    company: company.name,
    activeCandidates: activeAssignments.length,
    activeDistribution: roleDistribution(activeAssignments),
    archivedCandidates: archivedAssignments.length,
    archivedDistribution: roleDistribution(archivedAssignments),
  }, null, 2));

  if (!apply) {
    console.log("Dry run only. Re-run with --apply after reviewing this distribution.");
    return;
  }

  await db.transaction(async (tx) => {
    const challengeVersionByRole = new Map<RoleKey, string>();

    for (const key of Object.keys(ROLE_CONFIG) as RoleKey[]) {
      const config = ROLE_CONFIG[key];
      const opportunityId = canonicalOpportunityId.get(key)!;
      await tx
        .update(schema.opportunities)
        .set({
          role: config.role,
          description: config.description,
          duration: config.duration,
          hoursPerWeek: config.hoursPerWeek,
          location: "Doha, Qatar",
          workMode: "hybrid",
          slots: key === "finance" ? 1 : 2,
          skills: config.skills,
          status: "published",
          updatedAt: new Date(),
        })
        .where(eq(schema.opportunities.id, opportunityId));

      let [challenge] = await tx
        .select({ id: schema.challenges.id, currentVersionId: schema.challenges.currentVersionId })
        .from(schema.challenges)
        .where(eq(schema.challenges.opportunityId, opportunityId))
        .limit(1);

      if (!challenge) {
        [challenge] = await tx
          .insert(schema.challenges)
          .values({ opportunityId, status: "published" })
          .returning({ id: schema.challenges.id, currentVersionId: schema.challenges.currentVersionId });
      }

      let versionId = challenge.currentVersionId;
      if (!versionId) {
        const [version] = await tx
          .insert(schema.challengeVersions)
          .values({
            challengeId: challenge.id,
            versionNumber: 1,
            source: "approved",
            title: config.challenge.title,
            scenario: config.challenge.scenario,
            estimatedMinutes: 90,
            skills: config.challenge.skills,
            tasks: config.challenge.tasks.map((task) => ({ id: crypto.randomUUID(), ...task })),
            deliverables: config.challenge.deliverables,
            files: [],
            rubric: config.challenge.rubric,
            submissionRequirements: config.challenge.submissionRequirements,
          })
          .returning({ id: schema.challengeVersions.id });
        versionId = version.id;
        await tx
          .update(schema.challenges)
          .set({ currentVersionId: versionId, status: "published", updatedAt: new Date() })
          .where(eq(schema.challenges.id, challenge.id));
      }
      challengeVersionByRole.set(key, versionId);
    }

    const seenNames = new Set<string>();
    let replacementIndex = 0;
    for (const { row, role } of assignments.sort((a, b) => a.row.appliedAt.getTime() - b.row.appliedAt.getTime())) {
      const config = ROLE_CONFIG[role];
      const opportunityId = canonicalOpportunityId.get(role)!;
      await tx
        .update(schema.applications)
        .set({ opportunityId, updatedAt: new Date() })
        .where(eq(schema.applications.id, row.applicationId));

      if (row.submissionId) {
        await tx
          .update(schema.submissions)
          .set({ challengeVersionId: challengeVersionByRole.get(role)!, updatedAt: new Date() })
          .where(eq(schema.submissions.id, row.submissionId));
      }
      if (row.evidenceId) {
        const completed = row.status === "declined" || row.status === "withdrawn" ? "2/3 tasks completed" : "3/3 tasks completed";
        await tx
          .update(schema.candidateEvidence)
          .set({
            rubricVersionId: challengeVersionByRole.get(role)!,
            tasksCompleted: completed,
            aiSummary: `The submission contains evaluated evidence for the ${config.role} challenge.`,
            strength: `The work demonstrates relevant ${config.challenge.skills[0]} evidence.`,
            weakness: row.status === "declined" || row.status === "withdrawn"
              ? "One challenge task was not completed."
              : "The recruiter should verify the submitted work against the rubric.",
            updatedAt: new Date(),
          })
          .where(eq(schema.candidateEvidence.id, row.evidenceId));
      }
      if (row.programId) {
        await tx
          .update(schema.internshipPrograms)
          .set({ role: config.role, updatedAt: new Date() })
          .where(eq(schema.internshipPrograms.id, row.programId));
      }

      if (row.studentEmail.endsWith("@example.com")) {
        let fullName = row.studentName;
        const normalized = row.studentName.trim().toLowerCase();
        if (seenNames.has(normalized)) {
          fullName = DUPLICATE_REPLACEMENTS[replacementIndex++];
          if (!fullName) throw new Error("Not enough replacement names for duplicate demo candidates.");
        }
        seenNames.add(fullName.trim().toLowerCase());

        if (fullName !== row.studentName) {
          const slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
          await tx
            .update(schema.users)
            .set({ fullName, email: `demo.${slug}.${row.studentId.slice(0, 8)}@example.com`, updatedAt: new Date() })
            .where(eq(schema.users.id, row.studentId));
        }
        await tx
          .update(schema.studentProfiles)
          .set({
            major: config.major,
            skills: config.skills,
            availability: config.availability,
            updatedAt: new Date(),
          })
          .where(eq(schema.studentProfiles.userId, row.studentId));
      }
    }

    const staleEmptyOpportunityIds = opportunityRows
      .filter((row) => !usedOpportunityIds.has(row.id) && row.applications === 0)
      .map((row) => row.id);
    if (staleEmptyOpportunityIds.length > 0) {
      await tx.delete(schema.opportunities).where(inArray(schema.opportunities.id, staleEmptyOpportunityIds));
    }
  });

  console.log("Skyline candidate seed normalized successfully.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
