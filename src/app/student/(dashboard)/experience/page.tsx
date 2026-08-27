import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { StudentPageHeader } from "@/components/dashboard/student-page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { BadgeCheck } from "lucide-react";

export default async function StudentExperiencePage() {
  const { user } = await requireCurrentStudent();
  const db = getDb();

  const records = await db
    .select({
      record: schema.verifiedExperience,
      applicationId: schema.applications.id,
      role: schema.opportunities.role,
      companyName: schema.companies.name,
      durationWeeks: schema.internshipPrograms.durationWeeks,
    })
    .from(schema.verifiedExperience)
    .innerJoin(schema.internshipPrograms, eq(schema.verifiedExperience.programId, schema.internshipPrograms.id))
    .innerJoin(schema.internshipOffers, eq(schema.internshipPrograms.offerId, schema.internshipOffers.id))
    .innerJoin(schema.applications, eq(schema.internshipOffers.applicationId, schema.applications.id))
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(eq(schema.applications.studentId, user.id))
    .orderBy(desc(schema.verifiedExperience.verifiedAt));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <StudentPageHeader
        eyebrow="Verified Experience"
        title="Your verified work history"
        description="Once a supervisor confirms your internship, it becomes a permanent, credible record of what you actually did."
      />

      {records.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title="Nothing verified yet"
          description="Complete an internship through internIn and a supervisor will verify your work, skills, and final project here."
          ctaLabel="View your applications"
          ctaHref="/student/applications"
        />
      ) : (
        <div className="mt-8 max-w-2xl space-y-4">
          {records.map(({ record, applicationId, role, companyName, durationWeeks }) => (
            <div key={record.id} className="rounded-xl border border-navy/10 bg-white p-6">
              <div className="flex items-center gap-2">
                <BadgeCheck className="size-4 text-teal-ink" aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-ink">Verified by supervisor</p>
              </div>
              <h2 className="mt-2 text-lg font-semibold text-navy">
                {role} · {companyName}
              </h2>
              <p className="mt-0.5 text-sm text-navy/60">{durationWeeks}-week internship</p>

              <p className="mt-4 text-xs font-semibold uppercase text-navy/50">Work completed</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-navy/80">
                {record.workCompleted.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>

              <p className="mt-4 text-xs font-semibold uppercase text-navy/50">Skills demonstrated</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {record.skillsDemonstrated.map((s) => (
                  <span key={s} className="rounded-full bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal-ink">
                    {s}
                  </span>
                ))}
              </div>

              <Link
                href={`/student/applications/${applicationId}`}
                className="mt-5 inline-flex text-sm font-medium text-teal-ink hover:underline"
              >
                View full workspace
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
