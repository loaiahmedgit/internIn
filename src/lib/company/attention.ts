/**
 * "Needs your attention" is the most important section on Company Home —
 * it must only ever surface real, derivable state (a real submission count,
 * a real behind-schedule program, a real draft row). Nothing here is
 * synthesized to make the section look busy.
 */

export interface AttentionItem {
  key: string;
  message: string;
  subLabel: string;
  ctaLabel: string;
  ctaHref: string;
  icon: "review" | "schedule" | "draft";
  /** Lower sorts first — review queues outrank behind-schedule interns outrank incomplete drafts. */
  priority: 1 | 2 | 3;
}

export interface ReviewQueueInput {
  opportunityId: string;
  role: string;
  candidatesToReview: number;
}

export interface AttentionProgramInput {
  offerId: string;
  internName: string;
  role: string;
  severity: "needs_attention" | "behind_schedule";
}

export interface IncompleteDraftInput {
  opportunityId: string;
  role: string;
}

export function buildAttentionItems(input: {
  reviewQueues: ReviewQueueInput[];
  attentionPrograms: AttentionProgramInput[];
  incompleteDrafts: IncompleteDraftInput[];
}): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const q of input.reviewQueues) {
    if (q.candidatesToReview <= 0) continue;
    items.push({
      key: `review-${q.opportunityId}`,
      message: `${q.candidatesToReview} challenge ${q.candidatesToReview === 1 ? "submission" : "submissions"} ready for review`,
      subLabel: q.role,
      ctaLabel: "Review candidates",
      ctaHref: `/company/opportunities/${q.opportunityId}`,
      icon: "review",
      priority: 1,
    });
  }

  for (const p of input.attentionPrograms) {
    const verb = p.severity === "behind_schedule" ? "is behind schedule" : "needs attention";
    items.push({
      key: `program-${p.offerId}`,
      message: `${p.internName}'s program ${verb}`,
      subLabel: p.role,
      ctaLabel: "View intern",
      ctaHref: `/company/offers/${p.offerId}/program`,
      icon: "schedule",
      priority: 2,
    });
  }

  for (const d of input.incompleteDrafts) {
    items.push({
      key: `draft-${d.opportunityId}`,
      message: `${d.role} draft is incomplete`,
      subLabel: "Not yet published",
      ctaLabel: "Continue setup",
      ctaHref: `/company/opportunities/${d.opportunityId}/setup`,
      icon: "draft",
      priority: 3,
    });
  }

  return items.sort((a, b) => a.priority - b.priority);
}
