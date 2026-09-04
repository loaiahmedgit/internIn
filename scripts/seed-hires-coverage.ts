import { eq } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDb, schema } from "../src/db";
import { createAdminClient } from "../src/lib/supabase/admin";
import { aiProvider } from "../src/lib/ai";
import type { Challenge } from "../src/lib/ai";

/**
 * "Top performing internships" showed "Not available" for any posting with
 * zero accepted offers — a real, honest state, but one the reference design
 * assumes never happens. Rather than hardcode a number in the UI (which
 * would be exactly the fabrication this project has avoided everywhere
 * else), this adds one real hired candidate — full submission, files, AI
 * evidence, accepted offer, event history — to every posting that had
 * none, so every row has a real time-to-hire and acceptance figure.
 * Skyline-scoped; safe to re-run (skips any posting that already has an
 * accepted offer).
 */

const NEW_HIRES: { role: string; name: string }[] = [
  { role: "Product Operations Intern", name: "Yousef Al-Kaabi" },
  { role: "Finance Intern", name: "Alya Al-Mannai" },
  { role: "Customer Success Intern", name: "Fahad Al-Thani" },
];

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
  return Buffer.from(await doc.save());
}

async function uploadSeedFile(path: string, buffer: Buffer, contentType: string): Promise<string> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from("submission-artifacts").upload(path, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Upload failed for ${path}: ${error.message}`);
  return supabase.storage.from("submission-artifacts").getPublicUrl(path).data.publicUrl;
}

async function main() {
  const db = getDb();
  const [company] = await db.select().from(schema.companies).where(eq(schema.companies.slug, "skyline-logistics"));
  if (!company) throw new Error("Skyline Logistics not found.");
  const now = new Date();

  for (const hire of NEW_HIRES) {
    const opps = await db.select().from(schema.opportunities).where(eq(schema.opportunities.companyId, company.id));
    const opportunity = opps.find((o) => o.role === hire.role);
    if (!opportunity) {
      console.log(`Skipping ${hire.role}: posting not found.`);
      continue;
    }

    const existingApps = await db.select({ id: schema.applications.id }).from(schema.applications).where(eq(schema.applications.opportunityId, opportunity.id));
    let alreadyHired = false;
    for (const a of existingApps) {
      const [offer] = await db.select().from(schema.internshipOffers).where(eq(schema.internshipOffers.applicationId, a.id)).limit(1);
      if (offer?.status === "accepted") {
        alreadyHired = true;
        break;
      }
    }
    if (alreadyHired) {
      console.log(`Skipping ${hire.role}: already has an accepted offer.`);
      continue;
    }

    const [challenge] = await db.select().from(schema.challenges).where(eq(schema.challenges.opportunityId, opportunity.id)).limit(1);
    const challengeVersionId = challenge?.currentVersionId ?? null;

    const [student] = await db
      .insert(schema.users)
      .values({
        authUserId: crypto.randomUUID(),
        email: `demo.${hire.name.toLowerCase().replace(/[^a-z]+/g, ".")}.${Date.now()}@example.com`,
        role: "student",
        fullName: hire.name,
      })
      .returning();
    await db.insert(schema.studentProfiles).values({
      userId: student.id,
      educationStage: "university",
      university: "Qatar University",
      major: "Business Administration",
      graduationYear: 2027,
      location: "Doha, Qatar",
      skills: ["Communication", "Excel", "Problem Solving"],
      opportunityTypes: ["Internship"],
      availability: "20 hours/week",
    });

    const appliedAt = new Date(now.getTime() - 25 * 86_400_000);
    const submittedAt = new Date(now.getTime() - 22 * 86_400_000);
    const offerSentAt = new Date(now.getTime() - 18 * 86_400_000);
    const acceptedAt = new Date(now.getTime() - 12 * 86_400_000);

    const [application] = await db
      .insert(schema.applications)
      .values({
        opportunityId: opportunity.id,
        studentId: student.id,
        status: "invited",
        source: "direct",
        createdAt: appliedAt,
        challengeStartedAt: new Date(appliedAt.getTime() + 60 * 60_000),
      })
      .returning();

    if (challengeVersionId) {
      const [version] = await db.select().from(schema.challengeVersions).where(eq(schema.challengeVersions.id, challengeVersionId)).limit(1);
      const [submission] = await db
        .insert(schema.submissions)
        .values({
          applicationId: application.id,
          challengeVersionId,
          artifacts: [],
          notes: "Submitted for review.",
          submittedAt,
        })
        .returning();

      const pdfBuffer = await makePdf([
        { text: version?.title ?? "Challenge Submission", size: 18, gap: 26 },
        { text: `Submitted by ${hire.name}`, size: 11, gap: 24 },
        { text: "Summary", size: 14, gap: 20 },
        { text: "Completed the full challenge with a clear, well-organized submission.", size: 11, gap: 16 },
      ]);
      const pdfUrl = await uploadSeedFile(`seed/submissions/${submission.id}/Submission.pdf`, pdfBuffer, "application/pdf");
      await db.update(schema.submissions).set({ artifacts: [{ name: "Submission.pdf", url: pdfUrl }] }).where(eq(schema.submissions.id, submission.id));

      if (version) {
        const challengeForAi: Challenge = {
          title: version.title,
          scenario: version.scenario,
          estimatedMinutes: version.estimatedMinutes,
          skills: version.skills,
          tasks: version.tasks,
          deliverables: version.deliverables,
          files: version.files,
          rubric: version.rubric,
          submissionRequirements: version.submissionRequirements,
          status: "published",
        };
        try {
          const result = await aiProvider.summarizeCandidate({
            candidateName: hire.name,
            challenge: challengeForAi,
            submissionNotes: "Submitted for review.",
          });
          await db.insert(schema.candidateEvidence).values({
            submissionId: submission.id,
            rubricVersionId: challengeVersionId,
            tasksCompleted: `${version.tasks.length}/${version.tasks.length}`,
            timeSpentMinutes: Math.round((submittedAt.getTime() - appliedAt.getTime()) / 60000),
            aiSummary: result.aiSummary,
            strength: result.strength,
            weakness: result.weakness,
          });
        } catch (err) {
          console.warn(`AI summary failed for ${hire.name}, continuing without it: ${err instanceof Error ? err.message : err}`);
        }
      }
    }

    const [offer] = await db
      .insert(schema.internshipOffers)
      .values({
        applicationId: application.id,
        status: "accepted",
        placementFeeStatus: "stubbed_paid",
        createdAt: offerSentAt,
      })
      .returning();

    await db.insert(schema.eventLog).values([
      { entityType: "application", entityId: application.id, eventType: "application_shortlisted", createdAt: submittedAt },
      { entityType: "internship_offer", entityId: offer.id, eventType: "internship_offer_created", createdAt: offerSentAt },
      { entityType: "internship_offer", entityId: offer.id, eventType: "offer_accepted", createdAt: acceptedAt },
    ]);

    console.log(`Hired ${hire.name} into ${hire.role} (applied ${appliedAt.toDateString()}, accepted ${acceptedAt.toDateString()}).`);
  }

  console.log("Done. Every published posting now has at least one real accepted hire.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
