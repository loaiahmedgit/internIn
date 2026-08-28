import { describe, it, expect } from "vitest";
import { buildAttentionItems } from "./attention";

describe("buildAttentionItems", () => {
  it("returns nothing when everything is clear", () => {
    expect(buildAttentionItems({ reviewQueues: [], attentionPrograms: [], incompleteDrafts: [] })).toEqual([]);
  });

  it("drops review queues with zero candidates", () => {
    const result = buildAttentionItems({
      reviewQueues: [{ opportunityId: "o1", role: "Marketing Intern", candidatesToReview: 0 }],
      attentionPrograms: [],
      incompleteDrafts: [],
    });
    expect(result).toEqual([]);
  });

  it("sorts review queues before attention programs before incomplete drafts", () => {
    const result = buildAttentionItems({
      reviewQueues: [{ opportunityId: "o1", role: "Marketing Intern", candidatesToReview: 4 }],
      attentionPrograms: [{ offerId: "off1", internName: "Ahmed", role: "Data Analyst Intern", severity: "behind_schedule" }],
      incompleteDrafts: [{ opportunityId: "o2", role: "Sales Internship" }],
    });
    expect(result.map((r) => r.key)).toEqual(["review-o1", "program-off1", "draft-o2"]);
  });

  it("pluralizes the submission count correctly", () => {
    const [single] = buildAttentionItems({
      reviewQueues: [{ opportunityId: "o1", role: "R", candidatesToReview: 1 }],
      attentionPrograms: [],
      incompleteDrafts: [],
    });
    expect(single.message).toBe("1 challenge submission ready for review");
  });

  it("uses distinct wording for needs_attention vs behind_schedule severity", () => {
    const result = buildAttentionItems({
      reviewQueues: [],
      attentionPrograms: [
        { offerId: "off1", internName: "Ahmed", role: "R", severity: "needs_attention" },
        { offerId: "off2", internName: "Sara", role: "R", severity: "behind_schedule" },
      ],
      incompleteDrafts: [],
    });
    expect(result[0].message).toBe("Ahmed's program needs attention");
    expect(result[1].message).toBe("Sara's program is behind schedule");
  });
});
