import { eq } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDb, schema } from "../src/db";
import { createAdminClient } from "../src/lib/supabase/admin";
import { aiProvider } from "../src/lib/ai";
import type { Challenge } from "../src/lib/ai";

/**
 * Closes every remaining gap on Skyline Logistics' Candidates pages so a
 * real click-through never hits an unexplained empty state:
 *
 * - Any candidate past "applied" (shortlisted/invited/declined/withdrawn)
 *   who never got a submission (e.g. the intern-program seed rows, which
 *   were only ever given an offer) gets a real one, tied to their real
 *   opportunity's real challenge, with real uploaded files.
 * - Any submission missing candidate_evidence gets a REAL AI summary — this
 *   calls the actual configured aiProvider (GemmaProvider/OpenRouter, same
 *   one generateCandidateEvidenceAction uses), not fabricated text.
 * - Any submission with an empty artifacts array gets real uploaded files.
 * - Any application with no event_log history gets the real lifecycle
 *   events its current status implies, so the Activity tab isn't empty.
 *
 * Safe to re-run: every step checks for existing data first and only fills
 * what's actually missing.
 */

const DATA_ANALYST_OPPORTUNITY_ID = "05b21031-2caa-45f2-b81c-b9dcc9348edb";
const MARKETING_OPPORTUNITY_ID = "e8fe166a-2315-4e7f-9679-9f20d2891981";

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

async function makeArtifacts(isDataAnalyst: boolean, name: string, submissionId: string): Promise<{ name: string; url: string }[]> {
  const pdfBuffer = isDataAnalyst
    ? await makePdf([
        { text: "Warehouse Delay Investigation", size: 18, gap: 26 },
        { text: `Submitted by ${name}`, size: 11, gap: 24 },
        { text: "Finding", size: 14, gap: 20 },
        { text: "Dock 3 accounted for the largest share of delayed shipments over the", size: 11, gap: 16 },
        { text: "review period, with average unload time nearly double other docks.", size: 11, gap: 24 },
        { text: "Recommendation", size: 14, gap: 20 },
        { text: "Add a second unload crew to Dock 3 during the evening shift, when", size: 11, gap: 16 },
        { text: "the backlog consistently builds up.", size: 11, gap: 16 },
      ])
    : await makePdf([
        { text: "Product Launch Campaign Brief", size: 18, gap: 26 },
        { text: `Submitted by ${name}`, size: 11, gap: 24 },
        { text: "Target audience", size: 14, gap: 20 },
        { text: "Young professionals, 22-30, active on Instagram and TikTok, price-", size: 11, gap: 16 },
        { text: "conscious but drawn to brands with a clear point of view.", size: 11, gap: 24 },
        { text: "Post concepts", size: 14, gap: 20 },
        { text: "1. Launch-day countdown reel with behind-the-scenes footage.", size: 11, gap: 16 },
        { text: "2. Founder-voice carousel post explaining the product's 'why'.", size: 11, gap: 16 },
        { text: "3. UGC-style testimonial post from early beta testers.", size: 11, gap: 16 },
      ]);
  const pdfName = isDataAnalyst ? "Delay_Analysis.pdf" : "Campaign_Brief.pdf";
  const pdfUrl = await uploadSeedFile(`seed/submissions/${submissionId}/${pdfName}`, pdfBuffer, "application/pdf");
  const artifacts = [{ name: pdfName, url: pdfUrl }];
  if (isDataAnalyst) {
    const csvUrl = await uploadSeedFile(`seed/submissions/${submissionId}/shipment_log.csv`, Buffer.from(shipmentCsv()), "text/csv");
    artifacts.push({ name: "shipment_log.csv", url: csvUrl });
  }
  return artifacts;
}

async function main() {
  const db = getDb();

  const [company] = await db.select().from(schema.companies).where(eq(schema.companies.slug, "skyline-logistics"));
  if (!company) throw new Error("Skyline Logistics not found.");
  console.log(`Using company: ${company.name} (${company.id})`);

  const apps = await db
    .select({
      applicationId: schema.applications.id,
      opportunityId: schema.applications.opportunityId,
      studentId: schema.applications.studentId,
      status: schema.applications.status,
      appliedAt: schema.applications.createdAt,
      studentName: schema.users.fullName,
    })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.users, eq(schema.applications.studentId, schema.users.id))
    .where(eq(schema.opportunities.companyId, company.id));

  console.log(`Found ${apps.length} candidates on Skyline's opportunities.`);

  let submissionsCreated = 0;
  let evidenceGenerated = 0;
  let filesAttached = 0;
  let eventsLogged = 0;
  let aiSummaryFailures = 0;

  for (const app of apps) {
    const isDataAnalyst = app.opportunityId === DATA_ANALYST_OPPORTUNITY_ID || app.opportunityId !== MARKETING_OPPORTUNITY_ID;
    const [opportunity] = await db.select().from(schema.opportunities).where(eq(schema.opportunities.id, app.opportunityId)).limit(1);
    if (!opportunity) continue;
    const [challenge] = await db.select().from(schema.challenges).where(eq(schema.challenges.opportunityId, opportunity.id)).limit(1);
    const challengeVersionId = challenge?.currentVersionId ?? null;

    let [submission] = await db.select().from(schema.submissions).where(eq(schema.submissions.applicationId, app.applicationId)).limit(1);

    // A candidate who's been reviewed (anything past plain "applied") without
    // a submission is a gap, not a real "awaiting submission" case — the
    // intern-program seed rows hit this because they were only ever given
    // an offer, never a challenge.
    if (!submission && app.status !== "applied" && challengeVersionId) {
      const challengeStartedAt = new Date(app.appliedAt.getTime() + 20 * 60 * 1000);
      const [inserted] = await db
        .insert(schema.submissions)
        .values({
          applicationId: app.applicationId,
          challengeVersionId,
          artifacts: [],
          notes: "Submitted for review.",
          submittedAt: new Date(app.appliedAt.getTime() + 90 * 60 * 1000),
        })
        .returning();
      submission = inserted;
      await db.update(schema.applications).set({ challengeStartedAt }).where(eq(schema.applications.id, app.applicationId));
      submissionsCreated++;
    }

    if (submission && (!submission.artifacts || submission.artifacts.length === 0)) {
      const artifacts = await makeArtifacts(isDataAnalyst, app.studentName, submission.id);
      await db.update(schema.submissions).set({ artifacts }).where(eq(schema.submissions.id, submission.id));
      submission = { ...submission, artifacts };
      filesAttached++;
    }

    if (submission && challengeVersionId) {
      const [existingEvidence] = await db.select().from(schema.candidateEvidence).where(eq(schema.candidateEvidence.submissionId, submission.id)).limit(1);
      if (!existingEvidence) {
        const [version] = await db.select().from(schema.challengeVersions).where(eq(schema.challengeVersions.id, challengeVersionId)).limit(1);
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
          // The small model behind GemmaProvider occasionally runs away into
          // a repetition loop and never closes its JSON (hits the output
          // token cap, throws NoObjectGeneratedError) — one retry clears
          // that most of the time. Either way, a failure here must not take
          // down the other candidates in this loop.
          let result: Awaited<ReturnType<typeof aiProvider.summarizeCandidate>> | null = null;
          for (let attempt = 1; attempt <= 2 && !result; attempt++) {
            try {
              result = await aiProvider.summarizeCandidate({
                candidateName: app.studentName,
                challenge: challengeForAi,
                submissionNotes: submission.notes || "Submitted for review.",
              });
            } catch (err) {
              console.warn(`  AI summary attempt ${attempt} failed for ${app.studentName}: ${err instanceof Error ? err.message : err}`);
            }
          }
          if (!result) {
            aiSummaryFailures++;
            continue;
          }

          const timeSpentMinutes = Math.max(1, Math.round((submission.submittedAt.getTime() - app.appliedAt.getTime()) / 60000));
          await db.insert(schema.candidateEvidence).values({
            submissionId: submission.id,
            rubricVersionId: challengeVersionId,
            tasksCompleted: `${version.tasks.length}/${version.tasks.length}`,
            timeSpentMinutes,
            aiSummary: result.aiSummary,
            strength: result.strength,
            weakness: result.weakness,
          });
          await db.insert(schema.eventLog).values({
            entityType: "submission",
            entityId: submission.id,
            eventType: "evidence_generated",
          });
          evidenceGenerated++;
          console.log(`  AI summary generated for ${app.studentName}`);
        }
      }
    }

    // Backfill lifecycle events implied by the current status, if none exist yet.
    const existingEvents = await db.select().from(schema.eventLog).where(eq(schema.eventLog.entityId, app.applicationId));
    if (existingEvents.length === 0 && app.status !== "applied") {
      const eventType =
        app.status === "shortlisted"
          ? "application_shortlisted"
          : app.status === "declined"
            ? "application_declined"
            : app.status === "invited"
              ? "internship_offer_created"
              : null;
      if (eventType) {
        await db.insert(schema.eventLog).values({ entityType: "application", entityId: app.applicationId, eventType });
        eventsLogged++;
      }
    }
  }

  console.log(
    `Done. Submissions created: ${submissionsCreated}, files attached: ${filesAttached}, AI summaries generated: ${evidenceGenerated}, lifecycle events logged: ${eventsLogged}, AI summary failures (re-run to retry): ${aiSummaryFailures}.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
