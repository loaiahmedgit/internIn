import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { CreateInternshipForm } from "@/components/opportunities/create-internship-form";
import type { InternshipFormInput } from "@/lib/opportunities/actions";

export default async function EditOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireCurrentCompanyMember();
  const db = getDb();

  const [opportunity] = await db
    .select()
    .from(schema.opportunities)
    .where(and(eq(schema.opportunities.id, id), eq(schema.opportunities.companyId, membership.companyId)))
    .limit(1);
  if (!opportunity) notFound();

  const initial: Partial<InternshipFormInput> = {
    role: opportunity.role,
    department: opportunity.department,
    shortDescription: opportunity.shortDescription,
    description: opportunity.description,
    whatYouWillLearn: opportunity.whatYouWillLearn,
    requirements: opportunity.requirements,
    niceToHave: opportunity.niceToHave,
    duration: opportunity.duration,
    hoursPerWeek: opportunity.hoursPerWeek,
    location: opportunity.location,
    workMode: opportunity.workMode,
    applicationDeadline: opportunity.applicationDeadline,
    startDate: opportunity.startDate,
    slots: opportunity.slots,
    skills: opportunity.skills,
    requireCv: opportunity.requireCv,
    applicationQuestions: opportunity.applicationQuestions,
  };

  return <CreateInternshipForm opportunityId={id} initial={initial} />;
}
