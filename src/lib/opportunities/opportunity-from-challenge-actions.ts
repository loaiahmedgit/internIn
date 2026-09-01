"use server";

import { z } from "zod";
import { eq, and, inArray, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { ChallengeSchema, type Challenge } from "@/lib/ai";
import { ChallengeDraftSchema, type ChallengeDraft } from "@/lib/ai/challenge-clarification-schemas";
import { saveChallengeVersionAction, saveInternshipAction, publishOpportunityAction, type InternshipFormInput } from "@/lib/opportunities/actions";
import { saveChallengeDraftAction } from "@/lib/opportunities/challenge-draft-actions";
import { generateOpportunityFromChallenge } from "@/lib/ai/opportunity-from-challenge";
import { DRAFT_DURATION_SENTINEL, DRAFT_LOCATION_SENTINEL, DRAFT_HOURS_SENTINEL } from "@/lib/opportunities/opportunity-draft-sentinels";

const IdSchema = z.string().uuid();

/**
 * The "Create internship from this draft" entry point. Generates real
 * posting copy from the ALREADY-APPROVED ChallengeDraft (one small model
 * call — see generateOpportunityFromChallenge), saves it as a normal draft
 * opportunity through the same saveInternshipAction every manual save uses,
 * then attaches the challenge via the existing saveChallengeDraftAction.
 * Never re-runs the assistant router, never re-asks clarification
 * questions, never generates a second challenge draft.
 */
export async function createOpportunityFromChallengeDraftAction(draft: ChallengeDraft): Promise<{ opportunityId: string }> {
  const validatedDraft = ChallengeDraftSchema.parse(draft);
  const generated = await generateOpportunityFromChallenge(validatedDraft);

  const form: InternshipFormInput = {
    role: generated.title,
    department: null,
    shortDescription: generated.shortDescription ?? null,
    description: generated.description,
    whatYouWillLearn: generated.whatYouWillLearn ?? null,
    requirements: generated.requirements,
    niceToHave: generated.niceToHave,
    duration: DRAFT_DURATION_SENTINEL,
    hoursPerWeek: DRAFT_HOURS_SENTINEL,
    location: DRAFT_LOCATION_SENTINEL,
    workMode: null,
    applicationDeadline: null,
    startDate: null,
    slots: 1,
    skills: validatedDraft.skills,
    requireCv: true,
    applicationQuestions: [],
  };

  const opportunityId = await saveInternshipAction({ publish: false, form });
  await saveChallengeDraftAction(opportunityId, validatedDraft);
  return { opportunityId };
}

const MissingDetailsSchema = z.object({
  location: z.string().trim().min(1).max(120),
  workMode: z.enum(["remote", "onsite", "hybrid"]).nullable(),
  duration: z.string().trim().min(1).max(80),
  hoursPerWeek: z.number().int().min(1).max(60),
  applicationDeadline: z.coerce.date().nullable(),
  startDate: z.coerce.date().nullable(),
  slots: z.number().int().min(1).max(100),
});
export type MissingOpportunityDetails = z.infer<typeof MissingDetailsSchema>;

/**
 * "Publish internship" — the one explicit, consequential action. Fills in
 * the employer-confirmed logistics, approves the current challenge version
 * (the employer already signaled approval by clicking "Approve & attach" —
 * see challenge-draft-card.tsx), then publishes through the same
 * publishOpportunityAction every other publish path in the app uses
 * (which itself re-checks the challenge is approved and flips both rows).
 */
export async function publishOpportunityFromReviewAction(opportunityId: string, missing: MissingOpportunityDetails): Promise<void> {
  const validatedId = IdSchema.parse(opportunityId);
  const validatedMissing = MissingDetailsSchema.parse(missing);
  const { membership } = await requireCurrentCompanyMember("hiring_access");
  const db = getDb();

  const [opportunity] = await db
    .select()
    .from(schema.opportunities)
    .where(and(eq(schema.opportunities.id, validatedId), eq(schema.opportunities.companyId, membership.companyId)))
    .limit(1);
  if (!opportunity) throw new Error("Internship draft not found.");

  await saveInternshipAction({
    opportunityId: validatedId,
    publish: false,
    form: {
      role: opportunity.role,
      department: opportunity.department,
      shortDescription: opportunity.shortDescription,
      description: opportunity.description,
      whatYouWillLearn: opportunity.whatYouWillLearn,
      requirements: opportunity.requirements,
      niceToHave: opportunity.niceToHave,
      duration: validatedMissing.duration,
      hoursPerWeek: validatedMissing.hoursPerWeek,
      location: validatedMissing.location,
      workMode: validatedMissing.workMode,
      applicationDeadline: validatedMissing.applicationDeadline,
      startDate: validatedMissing.startDate,
      slots: validatedMissing.slots,
      skills: opportunity.skills,
      requireCv: opportunity.requireCv,
      applicationQuestions: opportunity.applicationQuestions,
    },
  });

  const [challengeRow] = await db
    .select()
    .from(schema.challenges)
    .where(eq(schema.challenges.opportunityId, validatedId))
    .limit(1);

  if (challengeRow) {
    const [version] = challengeRow.currentVersionId
      ? await db.select().from(schema.challengeVersions).where(eq(schema.challengeVersions.id, challengeRow.currentVersionId)).limit(1)
      : await db
          .select()
          .from(schema.challengeVersions)
          .where(eq(schema.challengeVersions.challengeId, challengeRow.id))
          .orderBy(desc(schema.challengeVersions.versionNumber))
          .limit(1);
    if (version) {
      const approved: Challenge = ChallengeSchema.parse({
        title: version.title,
        scenario: version.scenario,
        estimatedMinutes: version.estimatedMinutes,
        skills: version.skills,
        tasks: version.tasks,
        deliverables: version.deliverables,
        files: version.files,
        rubric: version.rubric,
        status: "approved",
      });
      await saveChallengeVersionAction(validatedId, approved, "approved");
    }
  }

  await publishOpportunityAction(validatedId);
}

/** For the "Attach to an existing internship" picker — the employer's own
 * draft/published internships only (a closed listing isn't accepting a new
 * challenge). */
export async function listAttachableOpportunitiesAction(): Promise<{ id: string; role: string; status: "draft" | "published" }[]> {
  const { membership } = await requireCurrentCompanyMember("hiring_access");
  const db = getDb();
  const rows = await db
    .select({ id: schema.opportunities.id, role: schema.opportunities.role, status: schema.opportunities.status })
    .from(schema.opportunities)
    .where(and(eq(schema.opportunities.companyId, membership.companyId), inArray(schema.opportunities.status, ["draft", "published"])));
  return rows as { id: string; role: string; status: "draft" | "published" }[];
}
