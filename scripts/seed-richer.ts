import { eq } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDb, schema } from "../src/db";
import { createAdminClient } from "../src/lib/supabase/admin";

/**
 * Enriches existing demo data for Skyline Logistics with the profile fields,
 * real uploaded CV/challenge-file PDFs, and a few more candidates the
 * Candidates pages need to look real when browsed — rather than one-line
 * placeholders. Uploads real bytes to the real "submission-artifacts"
 * bucket (public) and links to them, same as the real student upload flow
 * would. Safe to re-run: existing rows are only backfilled (profile fields
 * that are already set, or artifacts already present, are left alone); new
 * candidates are always freshly inserted, so don't run this twice in a row
 * if you don't want extra rows.
 */

const DATA_ANALYST_OPPORTUNITY_ID = "05b21031-2caa-45f2-b81c-b9dcc9348edb";
const DATA_ANALYST_CHALLENGE_VERSION_ID = "6968e0b2-4843-4802-ac01-cd2d276d32e2";
const MARKETING_OPPORTUNITY_ID = "e8fe166a-2315-4e7f-9679-9f20d2891981";
const MARKETING_CHALLENGE_VERSION_ID = "0357c1dd-89b3-48cd-8d97-d961ffbc48c3";

const UNIVERSITIES = ["Qatar University", "Carnegie Mellon University in Qatar", "Georgetown University in Qatar", "Texas A&M University at Qatar", "VCU Qatar", "Northwestern University in Qatar"];
const DA_MAJORS = ["Business Analytics", "Statistics", "Computer Science", "Economics", "Information Systems"];
const MKT_MAJORS = ["Marketing", "Communication", "Business Administration", "Media Studies"];
const DA_SKILLS = ["Excel", "SQL", "Data Analysis", "Power BI", "Python", "Tableau"];
const MKT_SKILLS = ["Marketing", "Social Media", "Communication", "Copywriting", "Canva", "Content Strategy"];
const LOCATIONS = ["Doha, Qatar", "Al Rayyan, Qatar", "Al Wakrah, Qatar"];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function pickMany<T>(arr: T[], count: number, seed: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < count; i++) out.push(arr[(seed + i * 7) % arr.length]);
  return Array.from(new Set(out));
}

async function makePdf(lines: { text: string; size?: number; gap?: number }[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 740;
  for (const line of lines) {
    const size = line.size ?? 11;
    page.drawText(line.text, { x: 56, y, size, font: size >= 16 ? bold : font, color: rgb(0.12, 0.16, 0.24) });
    y -= line.gap ?? size + 10;
  }
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

async function uploadSeedFile(path: string, buffer: Buffer, contentType: string): Promise<string> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from("submission-artifacts").upload(path, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Upload failed for ${path}: ${error.message}`);
  const { data } = supabase.storage.from("submission-artifacts").getPublicUrl(path);
  return data.publicUrl;
}

async function makeCvPdf(name: string, major: string, university: string, gradYear: number, skills: string[], location: string): Promise<Buffer> {
  return makePdf([
    { text: name, size: 20, gap: 28 },
    { text: `${major} · Class of ${gradYear}`, size: 12, gap: 20 },
    { text: location, size: 10, gap: 24 },
    { text: "Education", size: 14, gap: 20 },
    { text: `${university} — ${major}`, size: 11, gap: 16 },
    { text: `Expected graduation: ${gradYear}`, size: 11, gap: 26 },
    { text: "Skills", size: 14, gap: 20 },
    { text: skills.join(", "), size: 11, gap: 26 },
    { text: "Experience", size: 14, gap: 20 },
    { text: "Volunteer coordinator, campus student association (2 years)", size: 11, gap: 16 },
    { text: "Part-time research assistant, university department", size: 11, gap: 16 },
  ]);
}

async function makeDataAnalystSubmissionPdf(name: string, tasksCompleted: string): Promise<Buffer> {
  return makePdf([
    { text: "Warehouse Delay Investigation", size: 18, gap: 26 },
    { text: `Submitted by ${name}`, size: 11, gap: 24 },
    { text: "Finding", size: 14, gap: 20 },
    { text: "Dock 3 accounted for the largest share of delayed shipments over the", size: 11, gap: 16 },
    { text: "review period, with average unload time nearly double other docks.", size: 11, gap: 24 },
    { text: "Recommendation", size: 14, gap: 20 },
    { text: "Add a second unload crew to Dock 3 during the evening shift, when", size: 11, gap: 16 },
    { text: "the backlog consistently builds up.", size: 11, gap: 24 },
    { text: "Notes", size: 14, gap: 20 },
    { text: tasksCompleted, size: 11, gap: 16 },
  ]);
}

async function makeMarketingSubmissionPdf(name: string, tasksCompleted: string): Promise<Buffer> {
  return makePdf([
    { text: "Product Launch Campaign Brief", size: 18, gap: 26 },
    { text: `Submitted by ${name}`, size: 11, gap: 24 },
    { text: "Target audience", size: 14, gap: 20 },
    { text: "Young professionals, 22-30, active on Instagram and TikTok, price-", size: 11, gap: 16 },
    { text: "conscious but drawn to brands with a clear point of view.", size: 11, gap: 24 },
    { text: "Post concepts", size: 14, gap: 20 },
    { text: "1. Launch-day countdown reel with behind-the-scenes footage.", size: 11, gap: 16 },
    { text: "2. Founder-voice carousel post explaining the 'why' behind the product.", size: 11, gap: 16 },
    { text: "3. UGC-style testimonial post from early beta testers.", size: 11, gap: 24 },
    { text: "Notes", size: 14, gap: 20 },
    { text: tasksCompleted, size: 11, gap: 16 },
  ]);
}

function shipmentCsv(): string {
  const header = "date,dock,shipments,avg_unload_minutes,delayed\n";
  const rows: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const dock = ["Dock 1", "Dock 2", "Dock 3", "Dock 4"][i % 4];
    const delayed = dock === "Dock 3" ? Math.round(3 + Math.random() * 4) : Math.round(Math.random() * 2);
    rows.push(`2026-07-${String((i % 28) + 1).padStart(2, "0")},${dock},${20 + (i % 6)},${dock === "Dock 3" ? 46 + (i % 5) : 24 + (i % 5)},${delayed}`);
  }
  return header + rows.join("\n") + "\n";
}

async function backfillProfile(db: ReturnType<typeof getDb>, opts: { userId: string; name: string; opportunityId: string; seed: number }) {
  const isDataAnalyst = opts.opportunityId === DATA_ANALYST_OPPORTUNITY_ID;
  const [existing] = await db.select().from(schema.studentProfiles).where(eq(schema.studentProfiles.userId, opts.userId)).limit(1);
  if (!existing) return null;

  const major = isDataAnalyst ? pick(DA_MAJORS, opts.seed) : pick(MKT_MAJORS, opts.seed);
  const university = pick(UNIVERSITIES, opts.seed);
  const location = pick(LOCATIONS, opts.seed);
  const gradYear = 2026 + (opts.seed % 3);
  const skills = pickMany(isDataAnalyst ? DA_SKILLS : MKT_SKILLS, 4, opts.seed);

  const patch: Partial<typeof schema.studentProfiles.$inferInsert> = {};
  if (!existing.educationStage) patch.educationStage = "university";
  if (!existing.university) patch.university = university;
  if (!existing.major) patch.major = major;
  if (!existing.graduationYear) patch.graduationYear = gradYear;
  if (!existing.location) patch.location = location;
  if (!existing.availability) patch.availability = isDataAnalyst ? "20 hours/week" : "15 hours/week";
  if (!existing.skills || existing.skills.length === 0) patch.skills = skills;
  if (!existing.opportunityTypes || existing.opportunityTypes.length === 0) patch.opportunityTypes = ["Internship"];

  if (!existing.cvUrl) {
    const cvBuffer = await makeCvPdf(opts.name, patch.major ?? existing.major ?? major, patch.university ?? existing.university ?? university, patch.graduationYear ?? existing.graduationYear ?? gradYear, patch.skills ?? existing.skills ?? skills, patch.location ?? existing.location ?? location);
    const path = `seed/cv/${opts.userId}.pdf`;
    patch.cvUrl = await uploadSeedFile(path, cvBuffer, "application/pdf");
  }

  if (Object.keys(patch).length > 0) {
    await db.update(schema.studentProfiles).set(patch).where(eq(schema.studentProfiles.userId, opts.userId));
  }
  return { major: patch.major ?? existing.major, university: patch.university ?? existing.university };
}

async function backfillSubmissionArtifacts(db: ReturnType<typeof getDb>, opts: { applicationId: string; name: string; opportunityId: string; tasksCompleted: string }) {
  const [submission] = await db.select().from(schema.submissions).where(eq(schema.submissions.applicationId, opts.applicationId)).limit(1);
  if (!submission || (submission.artifacts && submission.artifacts.length > 0)) return;

  const isDataAnalyst = opts.opportunityId === DATA_ANALYST_OPPORTUNITY_ID;
  const pdfBuffer = isDataAnalyst
    ? await makeDataAnalystSubmissionPdf(opts.name, opts.tasksCompleted)
    : await makeMarketingSubmissionPdf(opts.name, opts.tasksCompleted);
  const pdfName = isDataAnalyst ? "Delay_Analysis.pdf" : "Campaign_Brief.pdf";
  const pdfUrl = await uploadSeedFile(`seed/submissions/${submission.id}/${pdfName}`, pdfBuffer, "application/pdf");

  const artifacts: { name: string; url: string }[] = [{ name: pdfName, url: pdfUrl }];
  if (isDataAnalyst) {
    const csvUrl = await uploadSeedFile(`seed/submissions/${submission.id}/shipment_log.csv`, Buffer.from(shipmentCsv()), "text/csv");
    artifacts.push({ name: "shipment_log.csv", url: csvUrl });
  }

  await db.update(schema.submissions).set({ artifacts }).where(eq(schema.submissions.id, submission.id));
}

async function main() {
  const db = getDb();

  const [company] = await db.select().from(schema.companies).where(eq(schema.companies.slug, "skyline-logistics"));
  if (!company) throw new Error("Skyline Logistics not found.");
  console.log(`Using company: ${company.name} (${company.id})`);

  const [reviewer] = await db
    .select({ userId: schema.companyMembers.userId })
    .from(schema.companyMembers)
    .where(eq(schema.companyMembers.companyId, company.id))
    .limit(1);
  if (!reviewer) throw new Error("No company member found to author notes.");

  // --- 1. Backfill every existing candidate on this company's opportunities ---
  const existingApps = await db
    .select({
      applicationId: schema.applications.id,
      opportunityId: schema.applications.opportunityId,
      studentId: schema.applications.studentId,
      status: schema.applications.status,
      studentName: schema.users.fullName,
    })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.users, eq(schema.applications.studentId, schema.users.id))
    .where(eq(schema.opportunities.companyId, company.id));

  console.log(`Found ${existingApps.length} existing candidates to backfill.`);

  let seed = 0;
  for (const app of existingApps) {
    seed++;
    await backfillProfile(db, { userId: app.studentId, name: app.studentName, opportunityId: app.opportunityId, seed });
    await backfillSubmissionArtifacts(db, {
      applicationId: app.applicationId,
      name: app.studentName,
      opportunityId: app.opportunityId,
      tasksCompleted: "Submitted for review.",
    });
  }

  // A few internal reviewer notes for realism, spread across different candidates/stages.
  const noteTargets = existingApps.filter((a) => a.status === "shortlisted" || a.status === "invited").slice(0, 4);
  const noteBodies = [
    "Strong write-up, clear reasoning. Worth a call this week.",
    "Good technical depth. Let's compare against the other shortlisted candidate before deciding.",
    "Followed up by email — waiting to hear back on availability.",
    "Solid submission overall, a bit light on the recommendation section.",
  ];
  for (let i = 0; i < noteTargets.length; i++) {
    const [alreadyHasNote] = await db.select().from(schema.candidateNotes).where(eq(schema.candidateNotes.applicationId, noteTargets[i].applicationId)).limit(1);
    if (alreadyHasNote) continue;
    await db.insert(schema.candidateNotes).values({
      applicationId: noteTargets[i].applicationId,
      authorUserId: reviewer.userId,
      body: noteBodies[i % noteBodies.length],
    });
  }

  // --- 2. A handful of brand-new, fully-filled candidates for more variety ---
  async function makeStudent(fullName: string) {
    const [user] = await db
      .insert(schema.users)
      .values({
        authUserId: crypto.randomUUID(),
        email: `demo.${fullName.toLowerCase().replace(/\s+/g, ".")}.${Date.now()}.${Math.round(Math.random() * 1e6)}@example.com`,
        role: "student",
        fullName,
      })
      .returning();
    await db.insert(schema.studentProfiles).values({ userId: user.id });
    return user;
  }

  const newCandidateSpecs: {
    name: string;
    opportunityId: string;
    challengeVersionId: string;
    status: "applied" | "shortlisted" | "invited" | "declined" | "withdrawn";
    withSubmission: boolean;
    tasksCompleted?: string;
    source: "direct" | "referral" | "company_website";
  }[] = [
    { name: "Rania Fakhoury", opportunityId: DATA_ANALYST_OPPORTUNITY_ID, challengeVersionId: DATA_ANALYST_CHALLENGE_VERSION_ID, status: "applied", withSubmission: true, tasksCompleted: "Completed all three tasks with a clear, data-backed recommendation.", source: "direct" },
    { name: "Tariq Idris", opportunityId: DATA_ANALYST_OPPORTUNITY_ID, challengeVersionId: DATA_ANALYST_CHALLENGE_VERSION_ID, status: "shortlisted", withSubmission: true, tasksCompleted: "Good root-cause work; recommendation was a little generic.", source: "referral" },
    { name: "Dana Qassim", opportunityId: DATA_ANALYST_OPPORTUNITY_ID, challengeVersionId: DATA_ANALYST_CHALLENGE_VERSION_ID, status: "invited", withSubmission: true, tasksCompleted: "One of the strongest submissions — precise and well-organized.", source: "direct" },
    { name: "Bilal Marzouq", opportunityId: DATA_ANALYST_OPPORTUNITY_ID, challengeVersionId: DATA_ANALYST_CHALLENGE_VERSION_ID, status: "applied", withSubmission: false, source: "company_website" },
    { name: "Sara Hijazi", opportunityId: MARKETING_OPPORTUNITY_ID, challengeVersionId: MARKETING_CHALLENGE_VERSION_ID, status: "applied", withSubmission: true, tasksCompleted: "Clear audience definition and solid post concepts.", source: "direct" },
    { name: "Marwan Sultan", opportunityId: MARKETING_OPPORTUNITY_ID, challengeVersionId: MARKETING_CHALLENGE_VERSION_ID, status: "shortlisted", withSubmission: true, tasksCompleted: "Creative post concepts, audience section was thin.", source: "referral" },
    { name: "Lina Barakat", opportunityId: MARKETING_OPPORTUNITY_ID, challengeVersionId: MARKETING_CHALLENGE_VERSION_ID, status: "declined", withSubmission: true, tasksCompleted: "Missed the success-metric task entirely.", source: "company_website" },
    { name: "Zainab Odeh", opportunityId: MARKETING_OPPORTUNITY_ID, challengeVersionId: MARKETING_CHALLENGE_VERSION_ID, status: "applied", withSubmission: false, source: "direct" },
  ];

  for (const spec of newCandidateSpecs) {
    seed++;
    const student = await makeStudent(spec.name);
    await backfillProfile(db, { userId: student.id, name: spec.name, opportunityId: spec.opportunityId, seed });

    const challengeStartedAt = spec.withSubmission
      ? new Date(Date.now() - (45 + Math.round(Math.random() * 105)) * 60 * 1000)
      : undefined;
    const [application] = await db
      .insert(schema.applications)
      .values({
        opportunityId: spec.opportunityId,
        studentId: student.id,
        status: spec.status,
        source: spec.source,
        challengeStartedAt,
      })
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

      await backfillSubmissionArtifacts(db, {
        applicationId: application.id,
        name: spec.name,
        opportunityId: spec.opportunityId,
        tasksCompleted: spec.tasksCompleted ?? "Submitted for review.",
      });

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

  console.log("Richer seed complete for Skyline Logistics: backfilled profiles/CVs/files on existing candidates, added 8 new fully-filled candidates.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
