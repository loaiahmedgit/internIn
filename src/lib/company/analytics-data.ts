import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { computeProgramProgress } from "./program-progress";

export interface CompanyAnalytics {
  openInternships: number;
  activeInterns: number;
  needsAttentionCount: number;
  applicants: number;
  challengeCompletionRate: number | null;
  funnel: { applied: number; submitted: number; shortlisted: number; invited: number; accepted: number };
  challengeTiming: { startedCount: number; completedCount: number; medianCompletionMinutes: number | null };
  reviewTurnaround: { avgDaysToReview: number | null; awaitingReviewCount: number };
}

/**
 * Same shape as home-data's numbers, but the event-based ones (funnel,
 * applicants, challenge timing, review turnaround) are scoped to
 * applications created within `windowDays`. Point-in-time state (open
 * internships, active interns, needs-attention) isn't windowed — "how many
 * are open right now" doesn't have a meaningful date range.
 */
export async function getCompanyAnalytics(companyId: string, windowDays: number): Promise<CompanyAnalytics> {
  const db = getDb();
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const opportunities = await db
    .select({ id: schema.opportunities.id, status: schema.opportunities.status })
    .from(schema.opportunities)
    .where(eq(schema.opportunities.companyId, companyId));
  const opportunityIds = opportunities.map((o) => o.id);
  const openInternships = opportunities.filter((o) => o.status === "published").length;

  const allApplications = opportunityIds.length
    ? await db
        .select({
          id: schema.applications.id,
          status: schema.applications.status,
          challengeStartedAt: schema.applications.challengeStartedAt,
          updatedAt: schema.applications.updatedAt,
          createdAt: schema.applications.createdAt,
        })
        .from(schema.applications)
        .where(inArray(schema.applications.opportunityId, opportunityIds))
    : [];
  const applications = allApplications.filter((a) => a.createdAt >= cutoff);
  const applicationIds = applications.map((a) => a.id);
  const allApplicationIds = allApplications.map((a) => a.id);

  const allSubmissions = allApplicationIds.length
    ? await db
        .select({ applicationId: schema.submissions.applicationId, submittedAt: schema.submissions.submittedAt })
        .from(schema.submissions)
        .where(inArray(schema.submissions.applicationId, allApplicationIds))
    : [];
  const submissionByApplication = new Map(allSubmissions.map((s) => [s.applicationId, s]));
  const windowedApplicationIds = new Set(applicationIds);
  const hasSubmissionInWindow = new Set(allSubmissions.filter((s) => windowedApplicationIds.has(s.applicationId)).map((s) => s.applicationId));

  const offers = allApplicationIds.length
    ? await db.select().from(schema.internshipOffers).where(inArray(schema.internshipOffers.applicationId, allApplicationIds))
    : [];
  const offerIds = offers.map((o) => o.id);
  const offersByApplication = new Set(offers.filter((o) => windowedApplicationIds.has(o.applicationId)).map((o) => o.applicationId));

  const programs = offerIds.length
    ? await db.select().from(schema.internshipPrograms).where(inArray(schema.internshipPrograms.offerId, offerIds))
    : [];
  const activePrograms = programs.filter((p) => p.status === "active");

  // Needs attention reuses the same severity math as home-data, inline here to keep this file self-contained for the analytics slice.
  const programIds = activePrograms.map((p) => p.id);
  const weeks = programIds.length
    ? await db.select().from(schema.internshipWeeks).where(inArray(schema.internshipWeeks.programId, programIds))
    : [];
  const weekIds = weeks.map((w) => w.id);
  const tasks = weekIds.length
    ? await db.select().from(schema.internshipTasks).where(inArray(schema.internshipTasks.weekId, weekIds))
    : [];
  let needsAttentionCount = 0;
  for (const program of activePrograms) {
    const programWeeks = weeks.filter((w) => w.programId === program.id);
    const programWeekIds = new Set(programWeeks.map((w) => w.id));
    const programTasks = tasks.filter((t) => programWeekIds.has(t.weekId));
    const progress = computeProgramProgress(program, programWeeks, programTasks);
    if (progress.severity === "needs_attention" || progress.severity === "behind_schedule") needsAttentionCount += 1;
  }

  const funnel = {
    applied: applications.length,
    submitted: hasSubmissionInWindow.size,
    shortlisted: applications.filter((a) => a.status === "shortlisted").length,
    invited: applications.filter((a) => a.status === "invited").length,
    accepted: offersByApplication.size ? offers.filter((o) => offersByApplication.has(o.applicationId) && o.status === "accepted").length : 0,
  };

  const startedCount = applications.filter((a) => a.challengeStartedAt).length;
  const completedCount = hasSubmissionInWindow.size;
  const completionMinutes: number[] = [];
  for (const app of applications) {
    if (!app.challengeStartedAt) continue;
    const submission = submissionByApplication.get(app.id);
    if (!submission) continue;
    completionMinutes.push((submission.submittedAt.getTime() - app.challengeStartedAt.getTime()) / 60000);
  }
  completionMinutes.sort((a, b) => a - b);
  const medianCompletionMinutes =
    completionMinutes.length === 0
      ? null
      : completionMinutes.length % 2 === 1
        ? completionMinutes[(completionMinutes.length - 1) / 2]
        : (completionMinutes[completionMinutes.length / 2 - 1] + completionMinutes[completionMinutes.length / 2]) / 2;

  const reviewDays: number[] = [];
  let awaitingReviewCount = 0;
  for (const app of applications) {
    const submission = submissionByApplication.get(app.id);
    if (!submission) continue;
    if (app.status === "applied") {
      awaitingReviewCount += 1;
      continue;
    }
    reviewDays.push((app.updatedAt.getTime() - submission.submittedAt.getTime()) / 86400000);
  }
  const avgDaysToReview = reviewDays.length === 0 ? null : reviewDays.reduce((s, d) => s + d, 0) / reviewDays.length;

  return {
    openInternships,
    activeInterns: activePrograms.length,
    needsAttentionCount,
    applicants: applications.length,
    challengeCompletionRate: startedCount > 0 ? completedCount / startedCount : null,
    funnel,
    challengeTiming: { startedCount, completedCount, medianCompletionMinutes },
    reviewTurnaround: { avgDaysToReview, awaitingReviewCount },
  };
}
