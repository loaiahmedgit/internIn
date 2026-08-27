import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { getPublishedChallengeInfo } from "@/lib/opportunities/browse";
import { getSavedOpportunityIds } from "@/lib/opportunities/saved";
import { getChallengeState, type ChallengeState } from "@/lib/opportunities/challenge-state";
import { OpportunityCard, type OpportunityCardData } from "@/components/opportunities/opportunity-card";
import { StudentPageHeader } from "@/components/dashboard/student-page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Zap } from "lucide-react";

type TabKey = "to_do" | "in_progress" | "submitted" | "completed";
const TABS: { key: TabKey; label: string }[] = [
  { key: "to_do", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "submitted", label: "Submitted" },
  { key: "completed", label: "Completed" },
];

export default async function StudentChallengesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { user } = await requireCurrentStudent();
  const params = await searchParams;
  const activeTab: TabKey = TABS.some((t) => t.key === params.tab) ? (params.tab as TabKey) : "to_do";
  const db = getDb();

  const applications = await db
    .select({
      id: schema.applications.id,
      opportunityId: schema.applications.opportunityId,
      challengeStartedAt: schema.applications.challengeStartedAt,
    })
    .from(schema.applications)
    .where(eq(schema.applications.studentId, user.id));

  if (applications.length === 0) {
    return (
      <div className="mx-auto max-w-screen-2xl px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
        <StudentPageHeader
          eyebrow="Challenges"
          title="Show what you can do"
          description="Once you apply to a role, its Challenge shows up here — the real evidence companies actually review."
        />
        <EmptyState
          icon={Zap}
          title="No challenges yet"
          description="Apply to an opportunity to unlock its Challenge and start building evidence."
          ctaLabel="Browse opportunities"
          ctaHref="/student/opportunities"
        />
      </div>
    );
  }

  const applicationIds = applications.map((a) => a.id);
  const submissions = await db
    .select({ id: schema.submissions.id, applicationId: schema.submissions.applicationId })
    .from(schema.submissions)
    .where(inArray(schema.submissions.applicationId, applicationIds));
  const submissionIds = submissions.map((s) => s.id);
  const evidenceRows = submissionIds.length
    ? await db
        .select({ submissionId: schema.candidateEvidence.submissionId })
        .from(schema.candidateEvidence)
        .where(inArray(schema.candidateEvidence.submissionId, submissionIds))
    : [];
  const evidencedSubmissionIds = new Set(evidenceRows.map((e) => e.submissionId));
  const submissionByApplicationId = new Map(
    submissions.map((s) => [s.applicationId, { hasEvidence: evidencedSubmissionIds.has(s.id) }]),
  );

  const opportunityIds = applications.map((a) => a.opportunityId);
  const opportunityRows = await db
    .select({
      id: schema.opportunities.id,
      role: schema.opportunities.role,
      description: schema.opportunities.description,
      duration: schema.opportunities.duration,
      hoursPerWeek: schema.opportunities.hoursPerWeek,
      location: schema.opportunities.location,
      skills: schema.opportunities.skills,
      companyName: schema.companies.name,
      companyVerified: schema.companies.verified,
    })
    .from(schema.opportunities)
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(inArray(schema.opportunities.id, opportunityIds));
  const opportunityById = new Map(opportunityRows.map((o) => [o.id, o]));

  const [publishedChallengeInfo, savedIds] = await Promise.all([getPublishedChallengeInfo(), getSavedOpportunityIds(user.id)]);

  const withState: { opportunity: OpportunityCardData; skills: string[]; estimatedMinutes?: number; challengeState: ChallengeState }[] = [];
  for (const application of applications) {
    if (!publishedChallengeInfo.has(application.opportunityId)) continue;
    const opportunity = opportunityById.get(application.opportunityId);
    if (!opportunity) continue;
    withState.push({
      opportunity,
      skills: opportunity.skills,
      estimatedMinutes: publishedChallengeInfo.get(application.opportunityId)?.estimatedMinutes,
      challengeState: getChallengeState({
        challengePublished: true,
        application,
        submission: submissionByApplicationId.get(application.id),
      }),
    });
  }

  const grouped: Record<TabKey, typeof withState> = { to_do: [], in_progress: [], submitted: [], completed: [] };
  for (const item of withState) {
    if (item.challengeState.kind in grouped) grouped[item.challengeState.kind as TabKey].push(item);
  }

  const activeItems = grouped[activeTab];

  return (
    <div className="@container mx-auto max-w-screen-2xl px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <StudentPageHeader
        eyebrow="Challenges"
        title="Show what you can do"
        description="Challenges from opportunities you've applied to — real evidence, reviewed by real companies."
      />

      <div className="mt-8 flex flex-wrap gap-1 border-b border-navy/10">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "to_do" ? "/student/challenges" : `/student/challenges?tab=${tab.key}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key ? "border-teal text-teal-ink" : "border-transparent text-navy/50 hover:text-navy"
            }`}
          >
            {tab.label} ({grouped[tab.key].length})
          </Link>
        ))}
      </div>

      {activeItems.length === 0 ? (
        <p className="mt-8 text-sm text-navy/60">Nothing in this list yet.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 @2xl:grid-cols-2 @6xl:grid-cols-3">
          {activeItems.map((item) => (
            <OpportunityCard
              key={item.opportunity.id}
              opportunity={item.opportunity}
              skills={item.skills}
              saved={savedIds.has(item.opportunity.id)}
              estimatedMinutes={item.estimatedMinutes}
              challengeState={item.challengeState}
            />
          ))}
        </div>
      )}
    </div>
  );
}
