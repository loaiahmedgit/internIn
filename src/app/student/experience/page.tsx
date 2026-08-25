import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";

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
    <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
      <p className="text-xs font-medium tracking-[0.12em] text-teal-ink uppercase">Your work history</p>
      <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">
        Verified Experience.
      </h1>

      {records.length === 0 ? (
        <p className="mt-12 text-navy/68">
          Nothing verified yet — completed internships show up here once a supervisor marks them done.{" "}
          <Link href="/student/dashboard" className="text-teal-ink underline underline-offset-2">
            View your applications
          </Link>
          .
        </p>
      ) : (
        <div className="mt-12 space-y-4">
          {records.map(({ record, applicationId, role, companyName, durationWeeks }) => (
            <Link
              key={record.id}
              href={`/student/applications/${applicationId}`}
              className="block border border-teal/30 bg-teal/5 p-5 transition-colors hover:border-teal/50"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-ink">Verified</p>
              <h2 className="mt-1 text-lg font-bold text-navy">
                {companyName} — {role}, {durationWeeks} weeks
              </h2>
              <p className="mt-3 text-xs font-semibold uppercase text-navy/50">Work completed</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-navy/80">
                {record.workCompleted.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs font-semibold uppercase text-navy/50">Skills demonstrated</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {record.skillsDemonstrated.map((s) => (
                  <span key={s} className="rounded-full bg-white px-2.5 py-1 text-xs text-navy/68">
                    {s}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
