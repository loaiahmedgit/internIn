import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { InternshipProgramWizard } from "@/components/opportunities/internship-program-wizard";

export default async function NewInternshipProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { membership } = await requireCurrentCompanyMember();
  const db = getDb();

  const [row] = await db
    .select({
      offer: schema.internshipOffers,
      opportunityCompanyId: schema.opportunities.companyId,
      opportunityRole: schema.opportunities.role,
      opportunityHoursPerWeek: schema.opportunities.hoursPerWeek,
      internName: schema.users.fullName,
    })
    .from(schema.internshipOffers)
    .innerJoin(schema.applications, eq(schema.internshipOffers.applicationId, schema.applications.id))
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.users, eq(schema.applications.studentId, schema.users.id))
    .where(eq(schema.internshipOffers.id, id))
    .limit(1);

  if (!row || row.opportunityCompanyId !== membership.companyId) notFound();
  if (row.offer.status !== "accepted") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-navy/60">
        {row.internName} hasn&apos;t accepted this offer yet.
      </div>
    );
  }

  const [existingProgram] = await db
    .select({ id: schema.internshipPrograms.id })
    .from(schema.internshipPrograms)
    .where(eq(schema.internshipPrograms.offerId, row.offer.id))
    .limit(1);
  if (existingProgram) redirect(`/company/offers/${row.offer.id}/program`);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">Internship Program Builder</p>
      <h1 className="mt-1 text-2xl font-bold text-navy">Plan {row.internName}&apos;s internship</h1>
      <p className="mt-2 text-sm text-navy/60">
        Describe the internship in plain language and AI will draft a week-by-week plan. You can edit
        everything before it&apos;s created.
      </p>

      <InternshipProgramWizard
        offerId={row.offer.id}
        internName={row.internName}
        role={row.opportunityRole}
        defaultHoursPerWeek={row.opportunityHoursPerWeek}
      />
    </div>
  );
}
