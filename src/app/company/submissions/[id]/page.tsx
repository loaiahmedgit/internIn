import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { GenerateEvidenceButton } from "@/components/opportunities/generate-evidence-button";
import { InviteToInternshipButton } from "@/components/opportunities/invite-to-internship-button";

export default async function CandidateEvidencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { membership } = await requireCurrentCompanyMember();
  const db = getDb();

  const [row] = await db
    .select({
      submission: schema.submissions,
      applicationId: schema.applications.id,
      studentName: schema.users.fullName,
      opportunityRole: schema.opportunities.role,
      opportunityCompanyId: schema.opportunities.companyId,
      challengeVersion: schema.challengeVersions,
    })
    .from(schema.submissions)
    .innerJoin(schema.applications, eq(schema.submissions.applicationId, schema.applications.id))
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.users, eq(schema.applications.studentId, schema.users.id))
    .innerJoin(schema.challengeVersions, eq(schema.submissions.challengeVersionId, schema.challengeVersions.id))
    .where(eq(schema.submissions.id, id))
    .limit(1);

  if (!row || row.opportunityCompanyId !== membership.companyId) notFound();

  const { submission, applicationId, studentName, opportunityRole, challengeVersion } = row;

  const [evidence] = await db
    .select()
    .from(schema.candidateEvidence)
    .where(eq(schema.candidateEvidence.submissionId, submission.id))
    .limit(1);

  const [offer] = await db
    .select()
    .from(schema.internshipOffers)
    .where(eq(schema.internshipOffers.applicationId, applicationId))
    .limit(1);

  const existingProgram =
    offer &&
    (
      await db
        .select({ id: schema.internshipPrograms.id })
        .from(schema.internshipPrograms)
        .where(eq(schema.internshipPrograms.offerId, offer.id))
        .limit(1)
    )[0];

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">{opportunityRole}</p>
      <h1 className="mt-1 text-2xl font-bold text-navy">{studentName}</h1>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-cool/60 bg-white p-4">
          <p className="text-xs text-navy/50">Tasks completed</p>
          <p className="mt-1 font-medium text-navy">{evidence?.tasksCompleted ?? `?/${challengeVersion.tasks.length}`}</p>
        </div>
        <div className="rounded-lg border border-gray-cool/60 bg-white p-4">
          <p className="text-xs text-navy/50">Time spent</p>
          <p className="mt-1 font-medium text-navy">
            {evidence ? `${evidence.timeSpentMinutes} min` : "Not evaluated yet"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-cool/60 bg-white p-4">
          <p className="text-xs text-navy/50">AI usage</p>
          <p className="mt-1 font-medium text-navy capitalize">{submission.aiUsageMode.replace(/_/g, " ")}</p>
        </div>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-navy/50">Company rubric</h2>
      <ul className="mt-3 space-y-2">
        {challengeVersion.rubric.map((r) => (
          <li key={r.criterion} className="rounded-lg border border-gray-cool/60 bg-white p-3">
            <p className="font-medium text-navy">{r.criterion}</p>
            <p className="text-sm text-navy/60">{r.description}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-navy/50">Submission</h2>
      {submission.notes && <p className="mt-3 whitespace-pre-wrap text-navy/80">{submission.notes}</p>}
      {submission.artifacts.length > 0 && (
        <ul className="mt-3 space-y-1">
          {submission.artifacts.map((a) => (
            <li key={a.url}>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-teal-ink underline underline-offset-2"
              >
                View original work — {a.name}
              </a>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-navy/50">AI summary</h2>
      {evidence ? (
        <div className="mt-3 space-y-3">
          <p className="text-navy/80">{evidence.aiSummary}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-teal/30 bg-teal/5 p-3">
              <p className="text-xs font-semibold uppercase text-teal-ink">Strength</p>
              <p className="mt-1 text-sm text-navy/80">{evidence.strength}</p>
            </div>
            <div className="rounded-lg border border-gray-cool/60 bg-white p-3">
              <p className="text-xs font-semibold uppercase text-navy/50">Watch for</p>
              <p className="mt-1 text-sm text-navy/80">{evidence.weakness}</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-navy/60">No AI summary yet — generate one below.</p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <GenerateEvidenceButton submissionId={submission.id} hasExisting={!!evidence} />
        <InviteToInternshipButton
          applicationId={applicationId}
          candidateName={studentName}
          alreadyInvited={!!offer}
        />
        {offer?.status === "accepted" && (
          <Link
            href={`/company/offers/${offer.id}/program${existingProgram ? "" : "/new"}`}
            className="text-sm font-medium text-teal-ink underline underline-offset-2"
          >
            {existingProgram ? "View internship program" : "Build internship program"}
          </Link>
        )}
      </div>
    </div>
  );
}
