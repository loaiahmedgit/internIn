import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { ApplyButton } from "@/components/opportunities/apply-button";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { STUDENT_NAV_ITEMS } from "@/lib/dashboard-nav";
import { BadgeCheck, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();

  const [opportunity] = await db
    .select({
      id: schema.opportunities.id,
      companyId: schema.opportunities.companyId,
      role: schema.opportunities.role,
      description: schema.opportunities.description,
      duration: schema.opportunities.duration,
      hoursPerWeek: schema.opportunities.hoursPerWeek,
      location: schema.opportunities.location,
      skills: schema.opportunities.skills,
      status: schema.opportunities.status,
      companyName: schema.companies.name,
      companyVerified: schema.companies.verified,
    })
    .from(schema.opportunities)
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(eq(schema.opportunities.id, id))
    .limit(1);

  if (!opportunity) notFound();

  const currentUser = await getCurrentUser();

  // A draft or closed listing has no public audience — except the owning
  // company previewing its own, e.g. via the Internships page's
  // "Preview" / "View listing" actions.
  let isOwnerPreview = false;
  if (opportunity.status !== "published") {
    const [membership] = currentUser?.role === "company"
      ? await db
          .select({ id: schema.companyMembers.id })
          .from(schema.companyMembers)
          .where(and(eq(schema.companyMembers.userId, currentUser.id), eq(schema.companyMembers.companyId, opportunity.companyId)))
          .limit(1)
      : [];
    if (!membership) notFound();
    isOwnerPreview = true;
  }

  const [challenge] = await db
    .select({ estimatedMinutes: schema.challengeVersions.estimatedMinutes, taskCount: schema.challengeVersions.tasks })
    .from(schema.challenges)
    .innerJoin(schema.challengeVersions, eq(schema.challenges.currentVersionId, schema.challengeVersions.id))
    .where(and(eq(schema.challenges.opportunityId, opportunity.id), eq(schema.challenges.status, "published"), isNotNull(schema.challenges.currentVersionId)))
    .limit(1);

  let existingApplicationId: string | undefined;
  if (currentUser?.role === "student") {
    const [existing] = await db
      .select({ id: schema.applications.id })
      .from(schema.applications)
      .where(and(eq(schema.applications.opportunityId, opportunity.id), eq(schema.applications.studentId, currentUser.id)))
      .limit(1);
    existingApplicationId = existing?.id;
  }

  const content = (
    <>
      {isOwnerPreview && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-800">
          Preview only — this listing is {opportunity.status === "draft" ? "still a draft" : "closed"} and isn&apos;t visible to
          students.
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">{opportunity.companyName}</p>
        {opportunity.companyVerified && <BadgeCheck className="size-3.5 text-teal-ink" aria-label="Verified company" />}
      </div>
      <h1 className="mt-2 text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">{opportunity.role}</h1>
      <p className="mt-2 text-sm text-navy/68">
        {opportunity.duration} · {opportunity.hoursPerWeek}h/week · {opportunity.location}
      </p>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {opportunity.skills.map((s) => (
          <span key={s} className="rounded-full bg-gray-light px-2.5 py-1 text-xs text-navy/68">
            {s}
          </span>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-semibold text-navy">What you&apos;ll work on</h2>
      <p className="mt-2 whitespace-pre-wrap text-navy/80">{opportunity.description}</p>

      {opportunity.skills.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold text-navy">What you&apos;ll practice</h2>
          <p className="mt-2 text-navy/80">{opportunity.skills.join(", ")}.</p>
        </>
      )}

      <h2 className="mt-8 text-lg font-semibold text-navy">Who can apply</h2>
      <p className="mt-2 text-navy/80">
        Any student or recent graduate. internIn doesn&apos;t require years of prior experience — you show {opportunity.companyName} what you
        can do directly, through the Challenge below.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-navy">How selection works</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-navy/80">
        <li>Apply and complete the Challenge for this role.</li>
        <li>{opportunity.companyName} reviews your submission as real evidence of your ability.</li>
        <li>Strong candidates move to interview and offer.</li>
      </ol>

      {challenge && (
        <>
          <h2 className="mt-8 text-lg font-semibold text-navy">Challenge details</h2>
          <div className="mt-2 flex items-center gap-1.5 text-sm text-navy/68">
            <Clock className="size-4" aria-hidden="true" />
            <span>
              ~{challenge.estimatedMinutes} minutes · {challenge.taskCount.length} {challenge.taskCount.length === 1 ? "task" : "tasks"}
            </span>
          </div>
        </>
      )}

      {!isOwnerPreview && (
        <div className="mt-10">
          {existingApplicationId ? (
            <Link
              href={`/student/applications/${existingApplicationId}`}
              className="inline-flex rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal/90"
            >
              View your application
            </Link>
          ) : (
            <ApplyButton opportunityId={opportunity.id} />
          )}
        </div>
      )}
    </>
  );

  if (currentUser?.role === "student") {
    return (
      <DashboardShell eyebrow="Student" displayName={currentUser.fullName} navItems={STUDENT_NAV_ITEMS}>
        <div className="mx-auto max-w-3xl px-6 py-10 sm:px-10 sm:py-14 lg:px-14">{content}</div>
      </DashboardShell>
    );
  }

  const dashboardHref = currentUser ? (currentUser.role === "company" ? "/company/dashboard" : "/student/dashboard") : null;

  return (
    <div className="flex min-h-full flex-col">
      <Navbar dashboardHref={dashboardHref} />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8">{content}</div>
      </main>
      <Footer />
    </div>
  );
}
