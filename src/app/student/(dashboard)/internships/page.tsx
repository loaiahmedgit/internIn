import Link from "next/link";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";

function CompanyAvatar({ name }: { name: string }) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal/10 text-sm font-semibold text-teal-ink">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default async function StudentInternshipsPage() {
  const { user } = await requireCurrentStudent();
  const db = getDb();

  const offers = await db
    .select({
      applicationId: schema.applications.id,
      offerStatus: schema.internshipOffers.status,
      role: schema.opportunities.role,
      companyName: schema.companies.name,
    })
    .from(schema.internshipOffers)
    .innerJoin(schema.applications, eq(schema.internshipOffers.applicationId, schema.applications.id))
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(and(eq(schema.applications.studentId, user.id)));

  const pending = offers.filter((o) => o.offerStatus === "pending");
  const active = offers.filter((o) => o.offerStatus === "accepted");

  return (
    <div className="px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-teal-ink">Internships</p>
      <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">Your internships</h1>

      {offers.length === 0 ? (
        <p className="mt-8 text-navy/68">
          No internship offers yet — keep completing Challenges to get noticed.{" "}
          <Link href="/student/opportunities" className="text-teal-ink underline underline-offset-2">
            Browse opportunities
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 max-w-2xl space-y-8">
          {pending.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-navy/50">Pending your response</h2>
              <div className="mt-3 space-y-3">
                {pending.map((o) => (
                  <Link
                    key={o.applicationId}
                    href={`/student/applications/${o.applicationId}`}
                    className="flex items-center gap-4 rounded-xl border border-teal/30 bg-teal/5 p-5 transition-colors hover:border-teal/50"
                  >
                    <CompanyAvatar name={o.companyName} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">{o.companyName}</p>
                      <p className="mt-1 text-lg font-semibold text-navy">{o.role}</p>
                      <p className="mt-1 text-sm text-teal-ink">Internship offer — review and respond</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {active.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-navy/50">Active</h2>
              <div className="mt-3 space-y-3">
                {active.map((o) => (
                  <Link
                    key={o.applicationId}
                    href={`/student/applications/${o.applicationId}`}
                    className="flex items-center gap-4 rounded-xl border border-navy/10 bg-white p-5 shadow-[0_1px_2px_rgba(33,50,72,0.04)] transition-shadow hover:shadow-[0_8px_24px_rgba(33,50,72,0.08)]"
                  >
                    <CompanyAvatar name={o.companyName} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">{o.companyName}</p>
                      <p className="mt-1 text-lg font-semibold text-navy">{o.role}</p>
                      <p className="mt-1 text-sm text-navy/60">View your program, weekly tasks, and feedback</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
