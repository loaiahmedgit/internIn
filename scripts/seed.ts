import { getDb, schema } from "../src/db";
import { eq } from "drizzle-orm";

/**
 * Populates the existing (real) verified company with published
 * opportunities, plus one demo student application/submission/evidence,
 * so the app has real content to browse instead of empty states.
 *
 * The demo student has no real Supabase Auth account (random authUserId) —
 * it exists purely so applications/submissions/evidence have something to
 * reference. It can't sign in. Safe to re-run; it always creates new rows
 * rather than upserting, so don't run this repeatedly in one sitting.
 */

async function main() {
  const db = getDb();

  const [company] = await db.select().from(schema.companies).limit(1);
  if (!company) {
    console.error("No company found — sign up as a company first, then re-run this script.");
    process.exit(1);
  }
  console.log(`Using company: ${company.name} (${company.id})`);

  const opportunitiesToCreate = [
    {
      role: "Data Analyst Intern",
      description:
        "Support the operations team by analyzing shipment and inventory data to find efficiency improvements.",
      duration: "3 months",
      hoursPerWeek: 20,
      location: "Doha, Qatar",
      skills: ["Excel", "SQL", "Data Analysis"],
      challenge: {
        title: "Warehouse Delay Investigation",
        scenario:
          "You're joining the operations team at a fictional logistics company. Shipments from one warehouse have been consistently delayed for the past month, and the team needs to understand why before it affects customer contracts.",
        estimatedMinutes: 90,
        skills: ["Excel", "SQL", "Data Analysis"],
        tasks: [
          { id: crypto.randomUUID(), title: "Explore the shipment dataset", description: "Review the provided (synthetic) shipment log and identify obvious anomalies or patterns." },
          { id: crypto.randomUUID(), title: "Identify the root cause", description: "Narrow down which stage of the warehouse process is most associated with delays." },
          { id: crypto.randomUUID(), title: "Write a short recommendation", description: "Summarize your finding and propose one concrete fix the operations manager could act on." },
        ],
        deliverables: ["A short written analysis (1 page)", "Any supporting chart or table you used"],
        files: [{ name: "shipment_log.csv", description: "Synthetic shipment records for the past month" }],
        rubric: [
          { criterion: "Root cause accuracy", description: "Correctly narrows the delay to a specific stage using the data" },
          { criterion: "Clarity of recommendation", description: "Recommendation is concrete and actionable, not generic" },
        ],
      },
    },
    {
      role: "Marketing Intern",
      description: "Help plan and analyze a social media campaign for a new product launch.",
      duration: "2 months",
      hoursPerWeek: 15,
      location: "Doha, Qatar",
      skills: ["Marketing", "Social Media", "Communication"],
      challenge: {
        title: "Product Launch Campaign Brief",
        scenario:
          "A fictional consumer brand is launching a new product next quarter. You've been asked to draft the social media campaign concept the marketing team will pitch internally.",
        estimatedMinutes: 75,
        skills: ["Marketing", "Social Media", "Communication"],
        tasks: [
          { id: crypto.randomUUID(), title: "Define the target audience", description: "Describe who the campaign should speak to and why." },
          { id: crypto.randomUUID(), title: "Draft 3 post concepts", description: "Write three short post concepts (caption + visual idea) for the launch week." },
          { id: crypto.randomUUID(), title: "Propose a success metric", description: "State one metric the team should track to know if the campaign worked." },
        ],
        deliverables: ["A one-page campaign brief", "3 draft post concepts"],
        files: [],
        rubric: [
          { criterion: "Audience clarity", description: "Target audience is specific, not generic" },
          { criterion: "Concept quality", description: "Post concepts are concrete and on-brand" },
        ],
      },
    },
  ];

  const createdOpportunityIds: string[] = [];
  let firstChallengeVersionId: string | null = null;

  for (const item of opportunitiesToCreate) {
    const [opportunity] = await db
      .insert(schema.opportunities)
      .values({
        companyId: company.id,
        role: item.role,
        description: item.description,
        duration: item.duration,
        hoursPerWeek: item.hoursPerWeek,
        location: item.location,
        skills: item.skills,
        status: "published",
      })
      .returning();

    const [challenge] = await db
      .insert(schema.challenges)
      .values({ opportunityId: opportunity.id, status: "published" })
      .returning();

    const [version] = await db
      .insert(schema.challengeVersions)
      .values({
        challengeId: challenge.id,
        versionNumber: 1,
        source: "approved",
        title: item.challenge.title,
        scenario: item.challenge.scenario,
        estimatedMinutes: item.challenge.estimatedMinutes,
        skills: item.challenge.skills,
        tasks: item.challenge.tasks,
        deliverables: item.challenge.deliverables,
        files: item.challenge.files,
        rubric: item.challenge.rubric,
      })
      .returning();

    await db.update(schema.challenges).set({ currentVersionId: version.id }).where(eq(schema.challenges.id, challenge.id));

    createdOpportunityIds.push(opportunity.id);
    if (!firstChallengeVersionId) firstChallengeVersionId = version.id;
    console.log(`Created opportunity: ${item.role} (${opportunity.id})`);
  }

  // Demo student — no real auth account, exists only so the demo
  // application/submission/evidence below have something to reference.
  const [studentUser] = await db
    .insert(schema.users)
    .values({
      authUserId: crypto.randomUUID(),
      email: `demo.student.${Date.now()}@example.com`,
      role: "student",
      fullName: "Fatima Al-Sulaiti",
    })
    .returning();

  await db.insert(schema.studentProfiles).values({
    userId: studentUser.id,
    educationStage: "university",
    university: "Qatar University",
    major: "Business Administration",
    graduationYear: 2027,
    location: "Doha",
    interests: ["Business & Operations", "Marketing"],
    opportunityTypes: ["Internship"],
    skills: ["Excel", "SQL", "Communication"],
    availability: "20 hours/week",
  });
  console.log(`Created demo student: ${studentUser.fullName} (${studentUser.id})`);

  const [application] = await db
    .insert(schema.applications)
    .values({
      opportunityId: createdOpportunityIds[0],
      studentId: studentUser.id,
      status: "shortlisted",
    })
    .returning();

  const [submission] = await db
    .insert(schema.submissions)
    .values({
      applicationId: application.id,
      challengeVersionId: firstChallengeVersionId!,
      aiUsageMode: "ai_allowed",
      artifacts: [{ name: "analysis.pdf", url: "https://example.com/demo-analysis.pdf" }],
      notes:
        "I found that Dock 3 accounted for most of the delays — average unload time there was almost double the other docks. I think it's a staffing issue on the evening shift.",
      status: "reviewed",
    })
    .returning();

  await db.insert(schema.candidateEvidence).values({
    submissionId: submission.id,
    rubricVersionId: firstChallengeVersionId!,
    tasksCompleted: "3 of 3 tasks completed",
    timeSpentMinutes: 85,
    aiSummary:
      "The candidate correctly isolated Dock 3 as the primary bottleneck and connected it to a plausible staffing cause, then proposed a specific, actionable fix rather than a generic one.",
    strength: "Strong root-cause reasoning — went past the surface-level pattern to a specific operational explanation.",
    weakness: "Recommendation could have included a rough cost/impact estimate to help prioritize it.",
  });
  console.log(`Created demo application + submission + evidence (application ${application.id})`);

  console.log("\nDone. Refresh /opportunities to see the published listings, or check the company dashboard for the shortlisted candidate.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
