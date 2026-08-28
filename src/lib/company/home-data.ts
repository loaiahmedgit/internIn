import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { computeProgramProgress } from "./program-progress";
import { buildAttentionItems, type AttentionItem } from "./attention";

export interface InternshipActivityRow {
  opportunityId: string;
  role: string;
  status: "draft" | "published" | "closed";
  duration: string;
  location: string;
  applicantCount: number;
  candidatesToReview: number;
  challengeStatusLabel: string;
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
  statusLabel: "On track" | "Behind schedule" | "Not started";
}

export interface CompanyHomeData {
  openInternships: number;
  candidatesToReview: number;
  activeInterns: number;
  internsNeedingAttention: number;
  attentionItems: AttentionItem[];
  internshipActivity: InternshipActivityRow[];
  activeInternRows: ActiveInternRow[];
  funnel: { applied: number; submitted: number; shortlisted: number; invited: number; accepted: number };
}

const CHALLENGE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ai_generated: "AI generated",
  pending_approval: "Pending approval",
  approved: "Approved",
  published: "Published",
};

export async function getCompanyHomeData(companyId: string): Promise<CompanyHomeData> {
  const db = getDb();

  const opportunities = await db
    .select()
    .from(schema.opportunities)
    .where(eq(schema.opportunities.companyId, companyId));
  const opportunityIds = opportunities.map((o) => o.id);

  const challenges = opportunityIds.length
    ? await db.select().from(schema.challenges).where(inArray(schema.challenges.opportunityId, opportunityIds))
    : [];
  const challengeByOpportunity = new Map(challenges.map((c) => [c.opportunityId, c]));

  const applications = opportunityIds.length
    ? await db
        .select({
          id: schema.applications.id,
          opportunityId: schema.applications.opportunityId,
          status: schema.applications.status,
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
  const hasSubmissionByApplication = new Set(submissions.map((s) => s.applicationId));

  const applicantCountByOpportunity = new Map<string, number>();
  const reviewCountByOpportunity = new Map<string, number>();
  for (const app of applications) {
    applicantCountByOpportunity.set(app.opportunityId, (applicantCountByOpportunity.get(app.opportunityId) ?? 0) + 1);
    if (hasSubmissionByApplication.has(app.id) && app.status === "applied") {
      reviewCountByOpportunity.set(app.opportunityId, (reviewCountByOpportunity.get(app.opportunityId) ?? 0) + 1);
    }
  }
  const candidatesToReview = [...reviewCountByOpportunity.values()].reduce((sum, n) => sum + n, 0);

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

  const applicationById = new Map(applications.map((a) => [a.id, a]));
  const opportunityById = new Map(opportunities.map((o) => [o.id, o]));
  const offerById = new Map(offers.map((o) => [o.id, o]));

  const activeInternRows: ActiveInternRow[] = [];
  const behindPrograms: { offerId: string; internName: string; role: string }[] = [];

  for (const program of programs) {
    if (program.status !== "active") continue;
    const offer = offerById.get(program.offerId);
    const application = offer ? applicationById.get(offer.applicationId) : undefined;
    const opportunity = application ? opportunityById.get(application.opportunityId) : undefined;

    const programWeeks = weeks.filter((w) => w.programId === program.id);
    const programWeekIds = new Set(programWeeks.map((w) => w.id));
    const programTasks = tasks.filter((t) => programWeekIds.has(t.weekId));
    const progress = computeProgramProgress(program, programWeeks, programTasks);

    activeInternRows.push({
      offerId: program.offerId,
      internName: program.internName,
      role: program.role,
      durationWeeks: program.durationWeeks,
      currentWeekNumber: progress.currentWeekNumber,
      currentWeekTitle: progress.currentWeekTitle,
      tasksDone: progress.tasksDone,
      tasksTotal: progress.tasksTotal,
      statusLabel: progress.statusLabel,
    });

    if (progress.behindSchedule) {
      behindPrograms.push({
        offerId: program.offerId,
        internName: program.internName,
        role: opportunity?.role ?? program.role,
      });
    }
  }
  activeInternRows.sort(
    (a, b) => (a.statusLabel === "Behind schedule" ? -1 : 1) - (b.statusLabel === "Behind schedule" ? -1 : 1),
  );

  const internshipActivity: InternshipActivityRow[] = opportunities
    .map((o) => ({
      opportunityId: o.id,
      role: o.role,
      status: o.status,
      duration: o.duration,
      location: o.location,
      applicantCount: applicantCountByOpportunity.get(o.id) ?? 0,
      candidatesToReview: reviewCountByOpportunity.get(o.id) ?? 0,
      challengeStatusLabel: CHALLENGE_STATUS_LABEL[challengeByOpportunity.get(o.id)?.status ?? "draft"] ?? "Not started",
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
    behindPrograms,
    incompleteDrafts,
  });

  const funnel = {
    applied: applications.length,
    submitted: hasSubmissionByApplication.size,
    shortlisted: applications.filter((a) => a.status === "shortlisted").length,
    invited: applications.filter((a) => a.status === "invited").length,
    accepted: offers.filter((o) => o.status === "accepted").length,
  };

  return {
    openInternships: opportunities.filter((o) => o.status === "published").length,
    candidatesToReview,
    activeInterns: activeInternRows.length,
    internsNeedingAttention: behindPrograms.length,
    attentionItems,
    internshipActivity,
    activeInternRows,
    funnel,
  };
}
