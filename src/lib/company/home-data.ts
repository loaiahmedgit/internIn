import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { computeProgramProgress, type ProgramSeverity } from "./program-progress";
import { buildAttentionItems, type AttentionItem } from "./attention";

export interface InternshipActivityRow {
  opportunityId: string;
  role: string;
  status: "draft" | "published" | "closed";
  duration: string;
  location: string;
  applicantCount: number;
  candidatesToReview: number;
  challengeStatus: string;
  createdAt: Date;
}

export interface ActiveInternRow {
  offerId: string;
  internName: string;
  role: string;
  durationWeeks: number;
  currentWeekNumber: number;
  currentWeekTitle: string;
  tasksDone: number;
  tasksTotal: number;
  severity: Exclude<ProgramSeverity, "completed">;
}

export interface InternRow extends ActiveInternRow {
  programId: string;
  programStatus: "draft" | "active" | "completed";
}

export interface CompanyHomeData {
  openInternships: number;
  candidatesToReview: number;
  activeInterns: number;
  needsAttentionCount: number;
  attentionItems: AttentionItem[];
  internshipActivity: InternshipActivityRow[];
  activeInternRows: ActiveInternRow[];
  allInternRows: InternRow[];
  funnel: { applied: number; submitted: number; shortlisted: number; invited: number; accepted: number };
  challengeTiming: { startedCount: number; completedCount: number; medianCompletionMinutes: number | null };
  reviewTurnaround: { avgDaysToReview: number | null; awaitingReviewCount: number };
}

async function loadCompanyRawData(companyId: string) {
  const db = getDb();

  const opportunities = await db
    .select()
    .from(schema.opportunities)
    .where(eq(schema.opportunities.companyId, companyId));
  const opportunityIds = opportunities.map((o) => o.id);

  const challenges = opportunityIds.length
    ? await db.select().from(schema.challenges).where(inArray(schema.challenges.opportunityId, opportunityIds))
    : [];

  const applications = opportunityIds.length
    ? await db
        .select({
          id: schema.applications.id,
          opportunityId: schema.applications.opportunityId,
          status: schema.applications.status,
          challengeStartedAt: schema.applications.challengeStartedAt,
          updatedAt: schema.applications.updatedAt,
        })
        .from(schema.applications)
        .where(inArray(schema.applications.opportunityId, opportunityIds))
    : [];
  const applicationIds = applications.map((a) => a.id);

  const submissions = applicationIds.length
    ? await db
        .select({ applicationId: schema.submissions.applicationId, submittedAt: schema.submissions.submittedAt })
        .from(schema.submissions)
        .where(inArray(schema.submissions.applicationId, applicationIds))
    : [];

  const offers = applicationIds.length
    ? await db
        .select()
        .from(schema.internshipOffers)
        .where(inArray(schema.internshipOffers.applicationId, applicationIds))
    : [];
  const offerIds = offers.map((o) => o.id);

  const programs = offerIds.length
    ? await db.select().from(schema.internshipPrograms).where(inArray(schema.internshipPrograms.offerId, offerIds))
    : [];
  const programIds = programs.map((p) => p.id);

  const weeks = programIds.length
    ? await db.select().from(schema.internshipWeeks).where(inArray(schema.internshipWeeks.programId, programIds))
    : [];
  const weekIds = weeks.map((w) => w.id);
  const tasks = weekIds.length
    ? await db.select().from(schema.internshipTasks).where(inArray(schema.internshipTasks.weekId, weekIds))
    : [];

  return { opportunities, challenges, applications, submissions, offers, programs, weeks, tasks };
}

const CHALLENGE_STATUS_LABEL: Record<string, string> = {
  draft: "draft",
  ai_generated: "draft",
  pending_approval: "pending_approval",
  approved: "approved",
  published: "published",
};

export async function getCompanyHomeData(companyId: string): Promise<CompanyHomeData> {
  const { opportunities, challenges, applications, submissions, offers, programs, weeks, tasks } =
    await loadCompanyRawData(companyId);

  const challengeByOpportunity = new Map(challenges.map((c) => [c.opportunityId, c]));
  const hasSubmissionByApplication = new Set(submissions.map((s) => s.applicationId));
  const submissionByApplication = new Map(submissions.map((s) => [s.applicationId, s]));

  const applicantCountByOpportunity = new Map<string, number>();
  const reviewCountByOpportunity = new Map<string, number>();
  for (const app of applications) {
    applicantCountByOpportunity.set(app.opportunityId, (applicantCountByOpportunity.get(app.opportunityId) ?? 0) + 1);
    if (hasSubmissionByApplication.has(app.id) && app.status === "applied") {
      reviewCountByOpportunity.set(app.opportunityId, (reviewCountByOpportunity.get(app.opportunityId) ?? 0) + 1);
    }
  }
  const candidatesToReview = [...reviewCountByOpportunity.values()].reduce((sum, n) => sum + n, 0);

  const applicationById = new Map(applications.map((a) => [a.id, a]));
  const opportunityById = new Map(opportunities.map((o) => [o.id, o]));
  const offerById = new Map(offers.map((o) => [o.id, o]));

  const allInternRows: InternRow[] = [];
  const attentionPrograms: { offerId: string; internName: string; role: string; severity: "needs_attention" | "behind_schedule" }[] = [];

  for (const program of programs) {
    const offer = offerById.get(program.offerId);
    const application = offer ? applicationById.get(offer.applicationId) : undefined;
    const opportunity = application ? opportunityById.get(application.opportunityId) : undefined;

    const programWeeks = weeks.filter((w) => w.programId === program.id);
    const programWeekIds = new Set(programWeeks.map((w) => w.id));
    const programTasks = tasks.filter((t) => programWeekIds.has(t.weekId));
    const progress = computeProgramProgress(program, programWeeks, programTasks);

    const row: InternRow = {
      programId: program.id,
      programStatus: program.status,
      offerId: program.offerId,
      internName: program.internName,
      role: program.role,
      durationWeeks: program.durationWeeks,
      currentWeekNumber: progress.currentWeekNumber,
      currentWeekTitle: progress.currentWeekTitle,
      tasksDone: progress.tasksDone,
      tasksTotal: progress.tasksTotal,
      severity: progress.severity,
    };
    allInternRows.push(row);

    if (program.status === "active" && (progress.severity === "needs_attention" || progress.severity === "behind_schedule")) {
      attentionPrograms.push({
        offerId: program.offerId,
        internName: program.internName,
        role: opportunity?.role ?? program.role,
        severity: progress.severity,
      });
    }
  }

  const activeInternRows = allInternRows.filter((r) => r.programStatus === "active");
  const severityRank: Record<string, number> = { behind_schedule: 0, needs_attention: 1, not_started: 2, on_track: 3 };
  activeInternRows.sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9));

  const internshipActivity: InternshipActivityRow[] = opportunities
    .map((o) => ({
      opportunityId: o.id,
      role: o.role,
      status: o.status,
      duration: o.duration,
      location: o.location,
      applicantCount: applicantCountByOpportunity.get(o.id) ?? 0,
      candidatesToReview: reviewCountByOpportunity.get(o.id) ?? 0,
      challengeStatus: CHALLENGE_STATUS_LABEL[challengeByOpportunity.get(o.id)?.status ?? ""] ?? "none",
      createdAt: o.createdAt,
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const incompleteDrafts = opportunities
    .filter((o) => o.status === "draft")
    .map((o) => ({ opportunityId: o.id, role: o.role }));

  const attentionItems = buildAttentionItems({
    reviewQueues: opportunities.map((o) => ({
      opportunityId: o.id,
      role: o.role,
      candidatesToReview: reviewCountByOpportunity.get(o.id) ?? 0,
    })),
    attentionPrograms,
    incompleteDrafts,
  });

  const funnel = {
    applied: applications.length,
    submitted: hasSubmissionByApplication.size,
    shortlisted: applications.filter((a) => a.status === "shortlisted").length,
    invited: applications.filter((a) => a.status === "invited").length,
    accepted: offers.filter((o) => o.status === "accepted").length,
  };

  // Challenge timing: started = challengeStartedAt set; completed = has a submission.
  // Median completion time uses only applications with both a real start and a real submission timestamp.
  const startedCount = applications.filter((a) => a.challengeStartedAt).length;
  const completedCount = hasSubmissionByApplication.size;
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

  // Review turnaround: days between submission and the application leaving "applied" status.
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
  const avgDaysToReview =
    reviewDays.length === 0 ? null : reviewDays.reduce((sum, d) => sum + d, 0) / reviewDays.length;

  return {
    openInternships: opportunities.filter((o) => o.status === "published").length,
    candidatesToReview,
    activeInterns: activeInternRows.length,
    needsAttentionCount: attentionPrograms.length,
    attentionItems,
    internshipActivity,
    activeInternRows,
    allInternRows,
    funnel,
    challengeTiming: { startedCount, completedCount, medianCompletionMinutes },
    reviewTurnaround: { avgDaysToReview, awaitingReviewCount },
  };
}
