import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { getOpportunitiesWithMatch, getPublishedChallengeOpportunityIds } from "@/lib/opportunities/browse";
import { getSavedOpportunityIds } from "@/lib/opportunities/saved";
import { getChallengeState, type ChallengeState } from "@/lib/opportunities/challenge-state";
import { OpportunityCard, type OpportunityCardData } from "@/components/opportunities/opportunity-card";

function ChallengeGroup({
  title,
  items,
  savedIds,
}: {
  title: string;
  items: { opportunity: OpportunityCardData; challengeState: ChallengeState }[];
  savedIds: Set<string>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-10 first:mt-0">
      <h2 className="text-lg font-semibold tracking-[-0.02em] text-navy">
        {title} ({items.length})
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(({ opportunity, challengeState }) => (
          <OpportunityCard key={opportunity.id} opportunity={opportunity} saved={savedIds.has(opportunity.id)} challengeState={challengeState} />
        ))}
      </div>
    </div>
  );
}

export default async function StudentChallengesPage() {
  const { user } = await requireCurrentStudent();
  const db = getDb();

  const applications = await db
    .select({ id: schema.applications.id, opportunityId: schema.applications.opportunityId })
    .from(schema.applications)
    .where(eq(schema.applications.studentId, user.id));
  const applicationIds = applications.map((a) => a.id);
  const submissions = applicationIds.length
    ? await db
        .select({ applicationId: schema.submissions.applicationId, status: schema.submissions.status })
        .from(schema.submissions)
        .where(inArray(schema.submissions.applicationId, applicationIds))
    : [];
  const submissionByApplicationId = new Map(submissions.map((s) => [s.applicationId, s]));
  const applicationByOpportunityId = new Map(applications.map((a) => [a.opportunityId, a]));

  const [{ opportunities }, publishedChallengeIds, savedIds] = await Promise.all([
    getOpportunitiesWithMatch(user.id),
    getPublishedChallengeOpportunityIds(),
    getSavedOpportunityIds(user.id),
  ]);

  const withState = opportunities
    .filter((o) => publishedChallengeIds.has(o.id))
    .map((o) => {
      const application = applicationByOpportunityId.get(o.id);
      const submission = application ? submissionByApplicationId.get(application.id) : undefined;
      return { opportunity: o, challengeState: getChallengeState({ challengePublished: true, application, submission }) };
    });

  const inProgress = withState.filter((x) => x.challengeState.kind === "in_progress");
  const submitted = withState.filter((x) => x.challengeState.kind === "submitted" || x.challengeState.kind === "reviewed");
  const notStarted = withState.filter((x) => x.challengeState.kind === "not_started");

  return (
    <div className="px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-teal-ink">Challenges</p>
      <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">Show what you can do</h1>
      <p className="mt-2 text-sm text-navy/60">Every published Challenge you can start, continue, or have already submitted.</p>

      {withState.length === 0 ? (
        <p className="mt-8 text-navy/68">No published Challenges yet. Check back soon.</p>
      ) : (
        <>
          <ChallengeGroup title="In progress" items={inProgress} savedIds={savedIds} />
          <ChallengeGroup title="Submitted" items={submitted} savedIds={savedIds} />
          <ChallengeGroup title="Not started" items={notStarted} savedIds={savedIds} />
        </>
      )}
    </div>
  );
}
