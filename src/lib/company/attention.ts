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
  /** Lower sorts first — review queues outrank behind-schedule interns outrank incomplete drafts. */
  priority: 1 | 2 | 3;
}

export interface ReviewQueueInput {
  opportunityId: string;
  role: string;
  candidatesToReview: number;
}

export interface BehindProgramInput {
  offerId: string;
  internName: string;
  role: string;
}

export interface IncompleteDraftInput {
  opportunityId: string;
  role: string;
}

export function buildAttentionItems(input: {
  reviewQueues: ReviewQueueInput[];
  behindPrograms: BehindProgramInput[];
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
      priority: 1,
    });
  }

  for (const p of input.behindPrograms) {
    items.push({
      key: `behind-${p.offerId}`,
      message: `${p.internName}'s program is behind schedule`,
      subLabel: p.role,
      ctaLabel: "View intern",
      ctaHref: `/company/offers/${p.offerId}/program`,
      priority: 2,
    });
  }

  for (const d of input.incompleteDrafts) {
    items.push({
      key: `draft-${d.opportunityId}`,
      message: `${d.role} draft is incomplete`,
      subLabel: "Not yet published",
      ctaLabel: "Continue setup",
      ctaHref: `/company/opportunities/${d.opportunityId}`,
      priority: 3,
    });
  }

  return items.sort((a, b) => a.priority - b.priority);
}
