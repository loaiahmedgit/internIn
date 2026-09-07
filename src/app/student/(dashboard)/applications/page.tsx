import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { ArrowRight, ClipboardList, Clock3 } from "lucide-react";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { StatusRail } from "@/components/dashboard/status-rail";
import { Button } from "@/components/ui/button";
import { SURFACE_CARD_CLASS, SURFACE_CARD_HOVER_CLASS } from "@/lib/ui-surface";
import { applicationStage, applicationCtaLabel, APPLICATION_STAGE_LABEL, APPLICATION_STAGE_BADGE_CLASS } from "@/lib/opportunities/application-status";

type ApplicationTab = "all" | "active" | "review" | "offers" | "past";

const dateFormatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });

function CompanyAvatar({ name }: { name: string }) {
  return <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-teal/10 text-sm font-semibold text-teal-ink" aria-hidden="true">{name.charAt(0).toUpperCase()}</div>;
}

export default async function StudentApplicationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user } = await requireCurrentStudent();
  const db = getDb();
  const params = await searchParams;
  const requestedTab = params.tab;
  const tab: ApplicationTab = requestedTab === "active" || requestedTab === "review" || requestedTab === "offers" || requestedTab === "past" ? requestedTab : "all";

  const applications = await db
    .select({
      id: schema.applications.id,
      status: schema.applications.status,
      challengeStartedAt: schema.applications.challengeStartedAt,
      createdAt: schema.applications.createdAt,
      role: schema.opportunities.role,
      companyName: schema.companies.name,
    })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(eq(schema.applications.studentId, user.id));

  if (applications.length === 0) {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-5xl flex-col items-center justify-center px-4 py-12 text-center sm:px-6">
        <div className="flex size-14 items-center justify-center rounded-full bg-teal/8">
          <ClipboardList className="size-6 text-teal-ink" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-navy">No applications yet</h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-navy/58">
          Find an internship that interests you and apply when you&apos;re ready — your progress and next steps will show up here.
        </p>
        <Button render={<Link href="/student/opportunities" />} nativeButton={false} className="mt-6 h-10 bg-teal px-5 text-white hover:bg-teal-ink">
          Explore internships
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  const applicationIds = applications.map((a) => a.id);
  const [submissions, offers] = await Promise.all([
    db.select({ applicationId: schema.submissions.applicationId }).from(schema.submissions).where(inArray(schema.submissions.applicationId, applicationIds)),
    db.select({ applicationId: schema.internshipOffers.applicationId, status: schema.internshipOffers.status }).from(schema.internshipOffers).where(inArray(schema.internshipOffers.applicationId, applicationIds)),
  ]);
  const submittedIds = new Set(submissions.map((s) => s.applicationId));
  const offerByApplicationId = new Map(offers.map((o) => [o.applicationId, o]));

  const enriched = applications.map((application) => {
    const offerStatus = offerByApplicationId.get(application.id)?.status;
    const hasSubmission = submittedIds.has(application.id);
    const challengeStarted = Boolean(application.challengeStartedAt);
    const stage = applicationStage({ status: application.status, hasSubmission, challengeStarted, offerStatus });
    return { ...application, offerStatus, hasSubmission, challengeStarted, stage };
  });
  const counts: Record<ApplicationTab, number> = {
    all: enriched.length,
    active: enriched.filter((item) => item.stage !== "closed").length,
    review: enriched.filter((item) => item.stage === "under_review" || item.stage === "shortlisted").length,
    offers: enriched.filter((item) => item.stage === "offer_pending" || item.stage === "offer_accepted").length,
    past: enriched.filter((item) => item.stage === "closed").length,
  };
  const visible = enriched.filter((item) => {
    if (tab === "active") return item.stage !== "closed";
    if (tab === "review") return item.stage === "under_review" || item.stage === "shortlisted";
    if (tab === "offers") return item.stage === "offer_pending" || item.stage === "offer_accepted";
    if (tab === "past") return item.stage === "closed";
    return true;
  });
  const tabs: { key: ApplicationTab; label: string }[] = [{ key: "all", label: "All" }, { key: "active", label: "Active" }, { key: "review", label: "Under review" }, { key: "offers", label: "Offers" }, { key: "past", label: "Past" }];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <header><h1 className="text-balance text-3xl font-semibold tracking-[-0.045em] text-navy sm:text-4xl">Your applications</h1><p className="mt-2 text-sm text-navy/58 sm:text-base">Track progress and next steps in one place.</p></header>
      <nav aria-label="Application filters" className="mt-7 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((item) => <Link key={item.key} href={item.key === "all" ? "/student/applications" : `/student/applications?tab=${item.key}`} aria-current={tab === item.key ? "page" : undefined} className={`flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 ${tab === item.key ? "border-teal/15 bg-teal/10 text-teal-ink" : "border-navy/10 bg-white text-navy/58 hover:border-teal/20 hover:text-navy"}`}>{item.label}<span className="tabular-nums text-xs opacity-65">{counts[item.key]}</span></Link>)}
      </nav>

      {visible.length === 0 ? <div className="mt-10 rounded-2xl border border-navy/10 bg-white px-6 py-12 text-center"><p className="font-medium text-navy">Nothing here right now</p><p className="mt-1 text-sm text-navy/52">Applications will appear here when their status changes.</p></div> : (
        <div className="mt-7 space-y-3.5">
          {visible.map((application) => {
            const label = applicationCtaLabel(application.stage);
            // Filled/primary style for the states that need real action from
            // the student (start/continue the challenge, respond to an
            // offer); outline for everything they're just reviewing or
            // waiting on.
            const isPrimaryAction = application.stage === "not_started" || application.stage === "in_progress" || application.stage === "offer_pending";
            return (
              <article key={application.id} className={`${SURFACE_CARD_CLASS} ${SURFACE_CARD_HOVER_CLASS} p-5 hover:border-teal/20 sm:p-6`}>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <CompanyAvatar name={application.companyName} />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-lg font-semibold tracking-[-0.02em] text-navy">{application.role}</h2>
                      <p className="mt-0.5 truncate text-sm text-navy/54">{application.companyName}</p>
                      <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${APPLICATION_STAGE_BADGE_CLASS[application.stage]}`}>{APPLICATION_STAGE_LABEL[application.stage]}</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 sm:max-w-sm">
                    <StatusRail status={application.status} hasSubmission={application.hasSubmission} challengeStarted={application.challengeStarted} offerStatus={application.offerStatus} />
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-navy/45"><Clock3 className="size-3.5" aria-hidden="true" />Applied {dateFormatter.format(application.createdAt)}</p>
                  </div>
                  <Button render={<Link href={application.stage === "offer_accepted" ? "/student/internships" : `/student/applications/${application.id}`} />} nativeButton={false} variant={isPrimaryAction ? "default" : "outline"} className={`h-10 w-full px-4 sm:w-auto ${isPrimaryAction ? "bg-teal text-white hover:bg-teal-ink" : "border-navy/12 bg-white text-navy hover:bg-teal/5"}`}>{label}<ArrowRight className="size-4" aria-hidden="true" /></Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <aside className="mt-8 flex flex-col gap-3 rounded-2xl border border-teal/14 bg-teal/[0.05] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-navy">Keep your profile current</p><p className="mt-0.5 text-sm text-navy/54">Updated skills and availability help improve your recommendations.</p></div><Button render={<Link href="/student/profile" />} nativeButton={false} variant="outline" className="h-9 w-full border-teal/18 bg-white text-teal-ink hover:bg-white/70 sm:w-auto">Update profile</Button></aside>
    </div>
  );
}
