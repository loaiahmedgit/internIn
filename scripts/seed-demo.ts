import { getDb, schema } from "../src/db";
import { eq } from "drizzle-orm";

/**
 * Richer demo data for Skyline Logistics so the redesigned Company Home /
 * Internships / Candidates / Interns / Analytics pages can be browsed with
 * real variety instead of one or two rows. Fake student users (random
 * authUserId, can't sign in) exist only so applications/submissions/
 * programs have something real to reference. Safe to re-run — it always
 * inserts new rows, so don't run it twice in one sitting.
 */

const DATA_ANALYST_OPPORTUNITY_ID = "05b21031-2caa-45f2-b81c-b9dcc9348edb";
const DATA_ANALYST_CHALLENGE_VERSION_ID = "6968e0b2-4843-4802-ac01-cd2d276d32e2";
const MARKETING_OPPORTUNITY_ID = "e8fe166a-2315-4e7f-9679-9f20d2891981";
const MARKETING_CHALLENGE_VERSION_ID = "0357c1dd-89b3-48cd-8d97-d961ffbc48c3";

async function makeStudent(db: ReturnType<typeof getDb>, fullName: string) {
  const [user] = await db
    .insert(schema.users)
    .values({
      authUserId: crypto.randomUUID(),
      email: `demo.${fullName.toLowerCase().replace(/\s+/g, ".")}.${Date.now()}@example.com`,
      role: "student",
      fullName,
    })
    .returning();
  await db.insert(schema.studentProfiles).values({ userId: user.id });
  return user;
}

async function main() {
  const db = getDb();

  const [company] = await db.select().from(schema.companies).where(eq(schema.companies.slug, "skyline-logistics"));
  if (!company) throw new Error("Skyline Logistics not found.");
  console.log(`Using company: ${company.name} (${company.id})`);

  // --- One more opportunity, closed, for status variety in the table ---
  await db.insert(schema.opportunities).values({
    companyId: company.id,
    role: "Customer Success Intern",
    description: "Support the customer success team with onboarding calls and help-center content.",
    duration: "3 months",
    hoursPerWeek: 12,
    location: "Doha, Qatar",
    slots: 1,
    skills: ["Communication", "CRM"],
    status: "closed",
  });

  // --- Candidates across every stage, spread over both published roles ---
  const candidateSpecs: {
    name: string;
    opportunityId: string;
    challengeVersionId: string;
    status: "applied" | "shortlisted" | "invited" | "declined" | "withdrawn";
    withSubmission: boolean;
    tasksCompleted?: string;
  }[] = [
    { name: "Layla Haddad", opportunityId: DATA_ANALYST_OPPORTUNITY_ID, challengeVersionId: DATA_ANALYST_CHALLENGE_VERSION_ID, status: "applied", withSubmission: true, tasksCompleted: "Completed both analysis tasks and the summary write-up." },
    { name: "Omar Nasser", opportunityId: DATA_ANALYST_OPPORTUNITY_ID, challengeVersionId: DATA_ANALYST_CHALLENGE_VERSION_ID, status: "shortlisted", withSubmission: true, tasksCompleted: "Completed the delay analysis; summary was brief." },
    { name: "Fatima Al-Sayed", opportunityId: DATA_ANALYST_OPPORTUNITY_ID, challengeVersionId: DATA_ANALYST_CHALLENGE_VERSION_ID, status: "declined", withSubmission: true, tasksCompleted: "Only partially completed the data-cleaning task." },
    { name: "Youssef Kamal", opportunityId: DATA_ANALYST_OPPORTUNITY_ID, challengeVersionId: DATA_ANALYST_CHALLENGE_VERSION_ID, status: "applied", withSubmission: false },
    { name: "Hana Farouk", opportunityId: MARKETING_OPPORTUNITY_ID, challengeVersionId: MARKETING_CHALLENGE_VERSION_ID, status: "applied", withSubmission: true, tasksCompleted: "Delivered a full campaign brief with competitor research." },
    { name: "Karim Aziz", opportunityId: MARKETING_OPPORTUNITY_ID, challengeVersionId: MARKETING_CHALLENGE_VERSION_ID, status: "invited", withSubmission: true, tasksCompleted: "Strong campaign brief, clear channel recommendations." },
    { name: "Mariam Zaki", opportunityId: MARKETING_OPPORTUNITY_ID, challengeVersionId: MARKETING_CHALLENGE_VERSION_ID, status: "withdrawn", withSubmission: false },
  ];

  for (const spec of candidateSpecs) {
    const student = await makeStudent(db, spec.name);
    const [application] = await db
      .insert(schema.applications)
      .values({ opportunityId: spec.opportunityId, studentId: student.id, status: spec.status })
      .returning();

    if (spec.withSubmission) {
      const [submission] = await db
        .insert(schema.submissions)
        .values({
          applicationId: application.id,
          challengeVersionId: spec.challengeVersionId,
          artifacts: [],
          notes: "Submitted for review.",
        })
        .returning();

      // Give the ones the company has already acted on a real AI evidence summary.
      if (spec.status !== "applied" && spec.tasksCompleted) {
        await db.insert(schema.candidateEvidence).values({
          submissionId: submission.id,
          rubricVersionId: spec.challengeVersionId,
          tasksCompleted: spec.tasksCompleted,
          timeSpentMinutes: 60 + Math.round(Math.random() * 60),
          aiSummary: `${spec.name} submitted real work against the published rubric.`,
          strength: "Clear, well-organized submission.",
          weakness: "Could go deeper on one section.",
        });
      }
    }

    if (spec.status === "invited") {
      await db.insert(schema.internshipOffers).values({
        applicationId: application.id,
        status: "pending",
        placementFeeStatus: "stubbed_paid",
      });
    }
  }

  // --- Active/completed interns with a spread of real severities ---
  async function makeProgram(opts: {
    internName: string;
    role: string;
    opportunityId: string;
    programStatus: "active" | "completed";
    durationWeeks: number;
    hoursPerWeek: number;
    createdDaysAgo: number;
    weeks: { title: string; done: boolean }[];
  }) {
    const student = await makeStudent(db, opts.internName);
    const [application] = await db
      .insert(schema.applications)
      .values({ opportunityId: opts.opportunityId, studentId: student.id, status: "invited" })
      .returning();
    const [offer] = await db
      .insert(schema.internshipOffers)
      .values({ applicationId: application.id, status: "accepted", placementFeeStatus: "stubbed_paid" })
      .returning();

    const createdAt = new Date(Date.now() - opts.createdDaysAgo * 24 * 60 * 60 * 1000);
    const [program] = await db
      .insert(schema.internshipPrograms)
      .values({
        offerId: offer.id,
        internName: opts.internName,
        role: opts.role,
        durationWeeks: opts.durationWeeks,
        hoursPerWeek: opts.hoursPerWeek,
        status: opts.programStatus,
        createdAt,
        updatedAt: createdAt,
      })
      .returning();

    for (let i = 0; i < opts.weeks.length; i++) {
      const [week] = await db
        .insert(schema.internshipWeeks)
        .values({ programId: program.id, weekNumber: i + 1, title: opts.weeks[i].title, objectives: ["Deliver the week's task"] })
        .returning();
      await db.insert(schema.internshipTasks).values({
        weekId: week.id,
        title: `${opts.weeks[i].title} deliverable`,
        status: opts.weeks[i].done ? "done" : "pending",
      });
    }

    if (opts.programStatus === "completed") {
      await db.insert(schema.verifiedExperience).values({
        programId: program.id,
        workCompleted: opts.weeks.map((w) => w.title),
        skillsDemonstrated: ["Communication", "Problem solving"],
        supervisorVerified: true,
        verifiedAt: new Date(),
      });
    }

    return program;
  }

  // On track: created 1 week ago, week 1 done — right on pace.
  await makeProgram({
    internName: "Ethan Park",
    role: "Data Analyst Intern",
    opportunityId: DATA_ANALYST_OPPORTUNITY_ID,
    programStatus: "active",
    durationWeeks: 10,
    hoursPerWeek: 15,
    createdDaysAgo: 7,
    weeks: [
      { title: "Onboarding", done: true },
      { title: "Data cleaning", done: false },
    ],
  });

  // Needs attention: 2 weeks elapsed, only week 1 done — one week behind.
  await makeProgram({
    internName: "Nadia Farid",
    role: "Marketing Intern",
    opportunityId: MARKETING_OPPORTUNITY_ID,
    programStatus: "active",
    durationWeeks: 8,
    hoursPerWeek: 12,
    createdDaysAgo: 14,
    weeks: [
      { title: "Campaign research", done: true },
      { title: "Draft campaign brief", done: false },
      { title: "Channel plan", done: false },
    ],
  });

  // Completed: fully done, generates a real Verified Experience record.
  await makeProgram({
    internName: "James Patel",
    role: "Data Analyst Intern",
    opportunityId: DATA_ANALYST_OPPORTUNITY_ID,
    programStatus: "completed",
    durationWeeks: 8,
    hoursPerWeek: 15,
    createdDaysAgo: 60,
    weeks: [
      { title: "Onboarding", done: true },
      { title: "Data cleaning", done: true },
      { title: "Root-cause analysis", done: true },
      { title: "Final report", done: true },
    ],
  });

  console.log("Demo seed complete for Skyline Logistics.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
