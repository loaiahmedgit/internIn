import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";

export default async function StudentDashboardPage() {
  const { user } = await requireCurrentStudent();
  const db = getDb();

  const [profile] = await db
    .select({ educationStage: schema.studentProfiles.educationStage })
    .from(schema.studentProfiles)
    .where(eq(schema.studentProfiles.userId, user.id))
    .limit(1);
  if (!profile?.educationStage) redirect("/student/onboarding");

  const applications = await db
    .select({
      id: schema.applications.id,
      status: schema.applications.status,
      role: schema.opportunities.role,
      companyName: schema.companies.name,
    })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(eq(schema.applications.studentId, user.id));

  return (
    <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium tracking-[0.12em] text-teal-ink uppercase">Your applications</p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">
            Track your progress.
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/student/profile" className="text-sm font-medium text-teal-ink underline underline-offset-2">
            Profile
          </Link>
          <Link href="/student/experience" className="text-sm font-medium text-teal-ink underline underline-offset-2">
            Verified Experience
          </Link>
        </div>
      </div>

      {applications.length === 0 ? (
        <p className="mt-12 text-navy/68">
          You haven&apos;t applied to anything yet.{" "}
          <Link href="/opportunities" className="text-teal-ink underline underline-offset-2">
            Browse opportunities
          </Link>
          .
        </p>
      ) : (
        <div className="mt-12 space-y-3">
          {applications.map((a) => (
            <Link
              key={a.id}
              href={`/student/applications/${a.id}`}
              className="flex items-center justify-between border border-navy/12 bg-white p-5 transition-colors hover:border-teal/40"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">
                  {a.companyName}
                </p>
                <p className="mt-1 text-lg font-semibold text-navy">{a.role}</p>
              </div>
              <span className="rounded-full bg-gray-light px-3 py-1 text-xs font-medium capitalize text-navy/68">
                {a.status.replace(/_/g, " ")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
