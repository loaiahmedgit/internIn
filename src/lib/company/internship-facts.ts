import { eq, and, inArray, or, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { stageKeyOf } from "./candidate-stage";
import { formatDeadline } from "@/lib/format-date";
import { getHiringData } from "./hiring-data";
import { DAY_MS, hiringMetrics, hiringCohort, hiringActivity } from "./hiring-metrics";

export const EVENT_LABEL: Record<string, string> = {
  opportunity_created: "Internship created",
  opportunity_published: "Internship published",
  opportunity_edited: "Listing edited",
  challenge_published: "Internship published with its challenge",
  challenge_version_created: "Challenge draft updated",
  challenge_approved: "Challenge approved",
  application_shortlisted: "A candidate was shortlisted",
  application_declined: "A candidate was not selected",
  application_moved_to_review: "A candidate was moved back to review",
  internship_offer_created: "An offer was sent",
  internship_offer_withdrawn: "An offer was withdrawn",
  offer_accepted: "An offer was accepted",
  offer_declined: "An offer was declined",
};

/**
 * Builds the ONLY facts the "Ask internIn" assistant is allowed to state
 * numbers from — every line here is a real, already-computed value read
 * straight from the database for this one internship, never invented or
 * estimated. Returned as plain text because that's what gets embedded
 * directly in the model prompt (see answerInternshipQuestion).
 */
export async function buildInternshipFacts(opportunityId: string, companyId: string): Promise<string> {
  const db = getDb();

  const [opportunity] = await db
    .select()
    .from(schema.opportunities)
    .where(and(eq(schema.opportunities.id, opportunityId), eq(schema.opportunities.companyId, companyId)))
    .limit(1);
  if (!opportunity) throw new Error("Not authorized for this internship.");

  const apps = await db
    .select({
      id: schema.applications.id,
      status: schema.applications.status,
      createdAt: schema.applications.createdAt,
      studentId: schema.applications.studentId,
    })
    .from(schema.applications)
    .where(eq(schema.applications.opportunityId, opportunityId));

  const submissions = apps.length
    ? await db
        .select({ applicationId: schema.submissions.applicationId })
        .from(schema.submissions)
        .where(inArray(schema.submissions.applicationId, apps.map((a) => a.id)))
    : [];
  const hasSubmission = new Set(submissions.map((s) => s.applicationId));

  const counts = { toReview: 0, shortlisted: 0, offerSent: 0, notSelected: 0 };
  for (const a of apps) {
    const key = stageKeyOf({ status: a.status, hasSubmission: hasSubmission.has(a.id) });
    if (key === "to_review") counts.toReview++;
    else if (key === "shortlisted") counts.shortlisted++;
    else if (key === "invited") counts.offerSent++;
    else if (key === "not_selected") counts.notSelected++;
  }

  const offers = apps.length
    ? await db.select().from(schema.internshipOffers).where(inArray(schema.internshipOffers.applicationId, apps.map((a) => a.id)))
    : [];
  const hired = offers.filter((o) => o.status === "accepted").length;

  const lines: string[] = [];
  lines.push(`Internship: ${opportunity.role}${opportunity.department ? ` (${opportunity.department})` : ""}, status ${opportunity.status}.`);
  lines.push(`Total applicants: ${apps.length}.`);
  lines.push(`To review: ${counts.toReview}. Shortlisted: ${counts.shortlisted}. Offer sent: ${counts.offerSent}. Hired: ${hired}. Not selected: ${counts.notSelected}.`);
  lines.push(
    opportunity.applicationDeadline
      ? `Application deadline: ${formatDeadline(opportunity.applicationDeadline)} (${Math.ceil((opportunity.applicationDeadline.getTime() - Date.now()) / 86_400_000)} days from today).`
      : "No application deadline is set.",
  );
  lines.push(opportunity.startDate ? `Planned start date: ${formatDeadline(opportunity.startDate)}.` : "No start date is set.");
  lines.push(`Required skills listed on the posting: ${opportunity.skills.length ? opportunity.skills.join(", ") : "none listed"}.`);

  // Real skill-coverage: how many applicants' own profile skills overlap each required skill.
  if (opportunity.skills.length > 0 && apps.length > 0) {
    const profiles = await db
      .select({ userId: schema.studentProfiles.userId, skills: schema.studentProfiles.skills })
      .from(schema.studentProfiles)
      .where(inArray(schema.studentProfiles.userId, apps.map((a) => a.studentId)));
    const skillCoverage = opportunity.skills.map((skill) => {
      const count = profiles.filter((p) => p.skills.some((s) => s.toLowerCase() === skill.toLowerCase())).length;
      return `${skill}: ${count} of ${apps.length} applicants`;
    });
    lines.push(`Skill coverage among applicants — ${skillCoverage.join("; ")}.`);
  }

  const [challenge] = await db.select().from(schema.challenges).where(eq(schema.challenges.opportunityId, opportunityId)).limit(1);
  if (challenge?.currentVersionId) {
    const [version] = await db.select().from(schema.challengeVersions).where(eq(schema.challengeVersions.id, challenge.currentVersionId)).limit(1);
    lines.push(
      version
        ? `This internship has a challenge: "${version.title}", ${version.tasks.length} task(s), ${version.deliverables.length} deliverable(s), status ${challenge.status}.`
        : "This internship has a challenge in progress.",
    );
  } else {
    lines.push("This internship has no challenge yet.");
  }

  const activityEntityIds = [opportunityId, ...apps.map((a) => a.id), ...offers.map((o) => o.id)];
  const activity = activityEntityIds.length
    ? await db
        .select({ eventType: schema.eventLog.eventType, createdAt: schema.eventLog.createdAt })
        .from(schema.eventLog)
        .where(or(and(eq(schema.eventLog.entityType, "opportunity"), eq(schema.eventLog.entityId, opportunityId)), inArray(schema.eventLog.entityId, activityEntityIds)))
        .orderBy(desc(schema.eventLog.createdAt))
        .limit(6)
    : [];
  if (activity.length > 0) {
    lines.push(`Recent activity (most recent first): ${activity.map((e) => `${EVENT_LABEL[e.eventType] ?? e.eventType} (${formatDeadline(e.createdAt)})`).join("; ")}.`);
  } else {
    lines.push("No activity recorded yet.");
  }

  return lines.join("\n");
}

/**
 * The "All hiring" scope facts — real, already-computed numbers across
 * every posting in the company, reusing the exact same hiringMetrics logic
 * Home and Analytics already render from, so the assistant can never state
 * a figure that disagrees with what's on screen elsewhere.
 */
export async function buildCompanyHiringFacts(companyId: string): Promise<string> {
  const data = await getHiringData(companyId);
  const now = new Date();
  const m = hiringMetrics(data.applications);
  const published = data.postings.filter((p) => p.status === "published");

  const lines: string[] = [];
  lines.push(`Active internships: ${published.length}.`);
  lines.push(`Total applicants (all time): ${m.applicants}.`);
  lines.push(`To review: ${m.toReview}. Shortlisted: ${m.shortlisted}. Offer sent: ${m.offerSent}. Hired: ${m.accepted}. Not selected: ${m.archived}.`);

  const newThisWeek = hiringCohort(data.applications, 7, now).length;
  const prevWeek = hiringCohort(data.applications, 14, now).length - newThisWeek;
  lines.push(`New applicants in the last 7 days: ${newThisWeek} (previous 7 days: ${prevWeek}).`);

  const weekly = hiringActivity(data.applications, 28, now);
  lines.push(`Weekly application counts, oldest to most recent: ${weekly.map((w) => w.count).join(", ")}.`);

  const closingSoon = published
    .filter((p) => p.applicationDeadline && p.applicationDeadline.getTime() - now.getTime() <= 7 * DAY_MS && p.applicationDeadline.getTime() >= now.getTime())
    .sort((a, b) => a.applicationDeadline!.getTime() - b.applicationDeadline!.getTime());
  lines.push(
    closingSoon.length > 0
      ? `Internships closing within 7 days: ${closingSoon.map((p) => `${p.role} (${formatDeadline(p.applicationDeadline!)})`).join("; ")}.`
      : "No internships closing within 7 days.",
  );

  lines.push("Per-internship breakdown:");
  for (const p of published) {
    const pm = hiringMetrics(data.applications.filter((a) => a.opportunityId === p.id));
    lines.push(
      `- ${p.role}: ${pm.applicants} applicants, ${pm.toReview} to review, ${pm.shortlisted} shortlisted, ${pm.offerSent} offer sent, ${pm.accepted} hired${p.applicationDeadline ? `, deadline ${formatDeadline(p.applicationDeadline)}` : ", no deadline set"}.`,
    );
  }

  return lines.join("\n");
}
