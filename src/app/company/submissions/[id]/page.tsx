import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { AiEvidenceSummary } from "@/components/company/ai-evidence-summary";
import { SubmissionArtifactCard } from "@/components/company/submission-artifact-card";
import { getCandidateDetail } from "@/lib/company/candidate-detail-data";
import {
  submissionDurationMinutes,
  formatSubmissionDuration,
} from "@/lib/company/candidate-insights";
import { hasPermission } from "@/lib/company/permissions";
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
    .innerJoin(
      schema.applications,
      eq(schema.submissions.applicationId, schema.applications.id),
    )
    .innerJoin(
      schema.opportunities,
      eq(schema.applications.opportunityId, schema.opportunities.id),
    )
    .innerJoin(schema.users, eq(schema.applications.studentId, schema.users.id))
    .innerJoin(
      schema.challengeVersions,
      eq(schema.submissions.challengeVersionId, schema.challengeVersions.id),
    )
    .where(eq(schema.submissions.id, id))
    .limit(1);

  if (!row || row.opportunityCompanyId !== membership.companyId) notFound();

  const {
    submission,
    applicationId,
    studentName,
    opportunityRole,
    challengeVersion,
  } = row;

  const [company] = await db
    .select({ evidenceAiEnabled: schema.companies.evidenceAiEnabled })
    .from(schema.companies)
    .where(eq(schema.companies.id, membership.companyId));
  const candidate = await getCandidateDetail(
    applicationId,
    membership.companyId,
    submission.id,
  );
  if (!candidate) notFound();
  const duration = submissionDurationMinutes(candidate);
  const canManagePrograms = hasPermission(membership, "program_supervisor");

  const [offer] = await db
    .select()
    .from(schema.internshipOffers)
    .where(eq(schema.internshipOffers.applicationId, applicationId))
    .limit(1);

  const existingProgram =
    canManagePrograms &&
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
      <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">
        {opportunityRole}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-navy">{studentName}</h1>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-cool/60 bg-white p-4">
          <p className="text-xs text-navy/50">Tasks completed</p>
          <p className="mt-1 font-medium text-navy">Needs human verification</p>
        </div>
        <div className="rounded-lg border border-gray-cool/60 bg-white p-4">
          <p className="text-xs text-navy/50">Time spent</p>
          <p className="mt-1 font-medium text-navy">
            {duration === null
              ? "Start time not recorded"
              : formatSubmissionDuration(duration)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-cool/60 bg-white p-4">
          <p className="text-xs text-navy/50">AI usage</p>
          <p className="mt-1 font-medium text-navy capitalize">
            {submission.aiUsageMode.replace(/_/g, " ")}
          </p>
        </div>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-navy/50">
        Company rubric
      </h2>
      <ul className="mt-3 space-y-2">
        {challengeVersion.rubric.map((r) => (
          <li
            key={r.criterion}
            className="rounded-lg border border-gray-cool/60 bg-white p-3"
          >
            <p className="font-medium text-navy">{r.criterion}</p>
            <p className="text-sm text-navy/60">{r.description}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-navy/50">
        Submission
      </h2>
      {submission.notes && (
        <p className="mt-3 whitespace-pre-wrap text-navy/80">
          {submission.notes}
        </p>
      )}
      {candidate.submission && candidate.submission.submissionArtifacts.length > 0 ? (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {candidate.submission.submissionArtifacts.map((a) => (
            <SubmissionArtifactCard key={a.id} artifact={a} />
          ))}
        </div>
      ) : (
        submission.artifacts.length > 0 && (
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
        )
      )}

      <div className="mt-8">
        <AiEvidenceSummary
          candidate={candidate}
          enabled={company.evidenceAiEnabled}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <InviteToInternshipButton
          applicationId={applicationId}
          candidateName={studentName}
          alreadyInvited={!!offer}
        />
        {canManagePrograms && offer?.status === "accepted" && (
          <Link
            href={`/company/offers/${offer.id}/program${existingProgram ? "" : "/new"}`}
            className="text-sm font-medium text-teal-ink underline underline-offset-2"
          >
            {existingProgram
              ? "View internship program"
              : "Build internship program"}
          </Link>
        )}
      </div>
    </div>
  );
}
