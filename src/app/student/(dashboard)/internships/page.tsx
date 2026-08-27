import Link from "next/link";
import { eq, desc, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { StudentPageHeader } from "@/components/dashboard/student-page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Building2 } from "lucide-react";

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
      offerId: schema.internshipOffers.id,
      offerStatus: schema.internshipOffers.status,
      applicationId: schema.applications.id,
      role: schema.opportunities.role,
      companyName: schema.companies.name,
    })
    .from(schema.internshipOffers)
    .innerJoin(schema.applications, eq(schema.internshipOffers.applicationId, schema.applications.id))
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(eq(schema.applications.studentId, user.id));

  const pending = offers.filter((o) => o.offerStatus === "pending");
  const active = offers.filter((o) => o.offerStatus === "accepted");

  const activePrograms = await Promise.all(
    active.map(async (offer) => {
      const [program] = await db
        .select({ id: schema.internshipPrograms.id, durationWeeks: schema.internshipPrograms.durationWeeks, status: schema.internshipPrograms.status })
        .from(schema.internshipPrograms)
        .where(eq(schema.internshipPrograms.offerId, offer.offerId))
        .limit(1);
      if (!program) return { offer, program: undefined, currentWeek: undefined, feedback: undefined };

      const weeks = await db
        .select({ id: schema.internshipWeeks.id, weekNumber: schema.internshipWeeks.weekNumber, title: schema.internshipWeeks.title, objectives: schema.internshipWeeks.objectives })
        .from(schema.internshipWeeks)
        .where(eq(schema.internshipWeeks.programId, program.id));
      const weekIds = weeks.map((w) => w.id);
      const tasks = weekIds.length
        ? await db.select().from(schema.internshipTasks).where(inArray(schema.internshipTasks.weekId, weekIds))
        : [];
      const sortedWeeks = [...weeks].sort((a, b) => a.weekNumber - b.weekNumber);
      const firstIncomplete = sortedWeeks.find((w) => tasks.some((t) => t.weekId === w.id && t.status !== "done"));
      const currentWeek = firstIncomplete ?? sortedWeeks[sortedWeeks.length - 1];
      const currentWeekTasks = currentWeek ? tasks.filter((t) => t.weekId === currentWeek.id) : [];

      const [feedback] = await db
        .select({ feedback: schema.supervisorFeedback.feedback, createdAt: schema.supervisorFeedback.createdAt, authorName: schema.users.fullName })
        .from(schema.supervisorFeedback)
        .innerJoin(schema.users, eq(schema.supervisorFeedback.authorUserId, schema.users.id))
        .where(eq(schema.supervisorFeedback.programId, program.id))
        .orderBy(desc(schema.supervisorFeedback.createdAt))
        .limit(1);

      return { offer, program, currentWeek, currentWeekTasks, feedback };
    }),
  );

  if (offers.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
        <StudentPageHeader eyebrow="Internships" title="Your internships" />
        <EmptyState
          icon={Building2}
          title="No internships yet"
          description="When you accept an internship through internIn, your program, weekly milestones, and supervisor feedback will live here."
          ctaLabel="Browse opportunities"
          ctaHref="/student/opportunities"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <StudentPageHeader eyebrow="Internships" title="Your internships" />

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

        {activePrograms.map(({ offer, program, currentWeek, currentWeekTasks, feedback }) => (
          <div key={offer.applicationId} className="rounded-xl border border-navy/10 bg-white p-6">
            <div className="flex items-center gap-4">
              <CompanyAvatar name={offer.companyName} />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">{offer.companyName}</p>
                <h2 className="mt-0.5 text-lg font-semibold text-navy">{offer.role}</h2>
              </div>
            </div>

            {program && currentWeek ? (
              <>
                <p className="mt-4 text-sm font-medium text-teal-ink">
                  Week {currentWeek.weekNumber} of {program.durationWeeks} — {currentWeek.title}
                </p>

                {currentWeek.objectives.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase text-navy/50">This week&apos;s objectives</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-navy/80">
                      {currentWeek.objectives.map((o) => (
                        <li key={o}>{o}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {currentWeekTasks && currentWeekTasks.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase text-navy/50">Assigned tasks</p>
                    <ul className="mt-1 space-y-1">
                      {currentWeekTasks.map((t) => (
                        <li key={t.id} className="flex items-center justify-between text-sm">
                          <span className={t.status === "done" ? "text-navy/40 line-through" : "text-navy/80"}>{t.title}</span>
                          <span className="rounded-full bg-gray-light px-2 py-0.5 text-xs capitalize text-navy/68">
                            {t.status.replace(/_/g, " ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {feedback && (
                  <div className="mt-4 border-t border-navy/8 pt-4">
                    <p className="text-xs font-semibold uppercase text-navy/50">Recent feedback</p>
                    <p className="mt-1 text-sm text-navy/80">&ldquo;{feedback.feedback}&rdquo;</p>
                    <p className="mt-1 text-xs text-navy/40">— {feedback.authorName}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-4 text-sm text-navy/60">Your program is being set up — check back soon.</p>
            )}

            <Link
              href={`/student/applications/${offer.applicationId}`}
              className="mt-5 inline-flex rounded-lg border border-teal/30 px-4 py-2 text-sm font-medium text-teal-ink transition-colors hover:bg-teal/5"
            >
              Open full workspace
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
