import { stageKeyOf } from "./candidate-stage";

export type HiringApplication = {
  id: string;
  opportunityId: string;
  name: string;
  status: "applied" | "shortlisted" | "invited" | "declined" | "withdrawn";
  appliedAt: Date;
  submittedAt: Date | null;
  source: string | null;
  offer: {
    status: "pending" | "accepted" | "declined";
    sentAt: Date;
    acceptedAt: Date | null;
  } | null;
};
export type HiringOpportunity = {
  id: string;
  role: string;
  status: string;
  location: string;
  workMode: string | null;
  applicationDeadline: Date | null;
  createdAt: Date;
};
export const DAY_MS = 86_400_000;
export const percent = (part: number, total: number) =>
  total ? `${((100 * part) / total).toFixed(1)}%` : "Not available";

/** The Candidates screen and operational dashboard use the same stage definition. */
export function hiringStage(row: HiringApplication) {
  return stageKeyOf({ status: row.status, hasSubmission: !!row.submittedAt });
}

export function hiringMetrics(rows: HiringApplication[]) {
  const count = (stage: string) =>
    rows.filter((r) => hiringStage(r) === stage).length;
  const toReview = count("to_review"),
    shortlisted = count("shortlisted"),
    offerSent = count("invited");
  const offers = rows.filter((r) => r.offer);
  const accepted = offers.filter((r) => r.offer?.status === "accepted");
  const decided = offers.filter((r) => r.offer?.status !== "pending");
  // Only immutable acceptance events establish time-to-hire, never mutable updated_at.
  const hireDurations = accepted.flatMap((r) =>
    r.offer?.acceptedAt && r.offer.acceptedAt >= r.appliedAt
      ? [(r.offer.acceptedAt.getTime() - r.appliedAt.getTime()) / DAY_MS]
      : [],
  );
  return {
    applicants: rows.length,
    active: toReview + shortlisted + offerSent,
    toReview,
    shortlisted,
    offerSent,
    archived: count("not_selected"),
    awaitingSubmission: count("applied"),
    submitted: rows.filter((r) => r.submittedAt).length,
    offers: offers.length,
    accepted: accepted.length,
    pending: offers.filter((r) => r.offer?.status === "pending").length,
    acceptance: decided.length ? accepted.length / decided.length : null,
    timeToHire: hireDurations.length
      ? hireDurations.reduce((a, b) => a + b, 0) / hireDurations.length
      : null,
    timedHires: hireDurations.length,
  };
}

export function hiringCohort(
  rows: HiringApplication[],
  days: number | null,
  now: Date,
) {
  return rows.filter(
    (r) =>
      r.appliedAt <= now &&
      (days === null || r.appliedAt.getTime() >= now.getTime() - days * DAY_MS),
  );
}

export function hiringActivity(
  rows: HiringApplication[],
  days: number,
  now: Date,
) {
  const bucketDays = days <= 7 ? 1 : 7;
  const buckets = Math.ceil(days / bucketDays);
  const start = now.getTime() - days * DAY_MS;
  return Array.from({ length: buckets }, (_, i) => {
    const from = start + i * bucketDays * DAY_MS;
    const to = Math.min(now.getTime() + 1, from + bucketDays * DAY_MS);
    return {
      date: new Date(from).toISOString(),
      count: rows.filter(
        (r) => r.appliedAt.getTime() >= from && r.appliedAt.getTime() < to,
      ).length,
    };
  });
}
