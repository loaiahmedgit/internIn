import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { StatusRail } from "@/components/dashboard/status-rail";
import { StudentPageHeader } from "@/components/dashboard/student-page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { relativeTime } from "@/lib/relative-time";
import { ClipboardList } from "lucide-react";

function CompanyAvatar({ name }: { name: string }) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal/10 text-sm font-semibold text-teal-ink">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function nextActionFor(params: { status: string; hasSubmission: boolean; offerStatus?: string }): string | undefined {
  if (params.status === "declined" || params.status === "withdrawn") return undefined;
  if (params.offerStatus === "pending") return "Respond to your offer";
  if (params.offerStatus === "accepted") return "View your internship workspace";
  if (params.status === "shortlisted") return "Wait for the company's decision";
  if (params.hasSubmission) return "Awaiting company review";
  return "Complete the Challenge";
}

export default async function StudentApplicationsPage() {
  const { user } = await requireCurrentStudent();
  const db = getDb();

  const applications = await db
    .select({
      id: schema.applications.id,
      status: schema.applications.status,
      updatedAt: schema.applications.updatedAt,
      role: schema.opportunities.role,
      companyName: schema.companies.name,
      skills: schema.opportunities.skills,
    })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(eq(schema.applications.studentId, user.id));

  if (applications.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
        <StudentPageHeader eyebrow="Applications" title="Your applications" />
        <EmptyState
          icon={ClipboardList}
          title="No applications yet"
          description="Apply to an opportunity to start building real evidence of what you can do."
          ctaLabel="Browse opportunities"
          ctaHref="/student/opportunities"
        />
      </div>
    );
  }

  const applicationIds = applications.map((a) => a.id);
  const submissions = await db
    .select({ applicationId: schema.submissions.applicationId })
    .from(schema.submissions)
    .where(inArray(schema.submissions.applicationId, applicationIds));
  const offers = await db
    .select({ applicationId: schema.internshipOffers.applicationId, status: schema.internshipOffers.status })
    .from(schema.internshipOffers)
    .where(inArray(schema.internshipOffers.applicationId, applicationIds));
  const submittedIds = new Set(submissions.map((s) => s.applicationId));
  const offerByApplicationId = new Map(offers.map((o) => [o.applicationId, o]));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <StudentPageHeader eyebrow="Applications" title="Your applications" />

      <div className="mt-8 max-w-2xl space-y-3">
        {applications.map((a) => {
          const offer = offerByApplicationId.get(a.id);
          const nextAction = nextActionFor({ status: a.status, hasSubmission: submittedIds.has(a.id), offerStatus: offer?.status });
          return (
            <Link
              key={a.id}
              href={`/student/applications/${a.id}`}
              className="flex items-start gap-4 rounded-xl border border-navy/10 bg-white p-5 shadow-[0_1px_2px_rgba(33,50,72,0.04)] transition-shadow hover:shadow-[0_8px_24px_rgba(33,50,72,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
            >
              <CompanyAvatar name={a.companyName} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">{a.companyName}</p>
                    <p className="mt-1 text-lg font-semibold text-navy">{a.role}</p>
                  </div>
                  <p className="shrink-0 text-xs text-navy/40">Updated {relativeTime(a.updatedAt)}</p>
                </div>
                {a.skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.skills.map((skill) => (
                      <span key={skill} className="rounded-full bg-gray-light px-2 py-0.5 text-xs text-navy/60">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3">
                  <StatusRail status={a.status} hasSubmission={submittedIds.has(a.id)} hasOffer={Boolean(offer)} />
                </div>
                {nextAction && <p className="mt-2 text-sm font-medium text-teal-ink">{nextAction}</p>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
