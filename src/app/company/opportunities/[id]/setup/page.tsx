import { redirect, notFound } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { CreateInternshipWizard } from "@/components/opportunities/create-internship-wizard";
import type { Challenge, InternshipDraft } from "@/lib/ai";

/**
 * Resumes an incomplete draft — the wizard has no partial-save mechanism of
 * its own, so "Continue setup" needs a page that reloads the real DB state
 * (the opportunity, and any challenge version already generated) and hands
 * it back to the same client wizard, picking up at the right step instead
 * of dropping the company on the empty candidates page.
 */
export default async function ResumeOpportunitySetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireCurrentCompanyMember();
  const db = getDb();

  const [opportunity] = await db
    .select()
    .from(schema.opportunities)
    .where(and(eq(schema.opportunities.id, id), eq(schema.opportunities.companyId, membership.companyId)))
    .limit(1);
  if (!opportunity) notFound();

  // Already published — nothing left to set up, send them to the real management page.
  if (opportunity.status !== "draft") {
    redirect(`/company/opportunities/${id}`);
  }

  const internship: InternshipDraft = {
    role: opportunity.role,
    duration: opportunity.duration,
    hoursPerWeek: opportunity.hoursPerWeek,
    location: opportunity.location,
    slots: opportunity.slots,
    skills: opportunity.skills,
    description: opportunity.description,
  };

  const [challengeRow] = await db
    .select()
    .from(schema.challenges)
    .where(eq(schema.challenges.opportunityId, id))
    .limit(1);

  let challenge: Challenge | undefined;
  if (challengeRow) {
    const [version] = challengeRow.currentVersionId
      ? await db
          .select()
          .from(schema.challengeVersions)
          .where(eq(schema.challengeVersions.id, challengeRow.currentVersionId))
          .limit(1)
      : await db
          .select()
          .from(schema.challengeVersions)
          .where(eq(schema.challengeVersions.challengeId, challengeRow.id))
          .orderBy(desc(schema.challengeVersions.versionNumber))
          .limit(1);
    if (version) {
      challenge = {
        title: version.title,
        scenario: version.scenario,
        estimatedMinutes: version.estimatedMinutes,
        skills: version.skills,
        tasks: version.tasks,
        deliverables: version.deliverables,
        files: version.files,
        rubric: version.rubric,
        status: challengeRow.status,
      };
    }
  }

  return <CreateInternshipWizard initial={{ opportunityId: id, internship, challenge }} />;
}
