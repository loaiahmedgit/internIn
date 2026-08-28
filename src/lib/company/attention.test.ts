import { describe, it, expect } from "vitest";
import { buildAttentionItems } from "./attention";

describe("buildAttentionItems", () => {
  it("returns nothing when everything is clear", () => {
    expect(buildAttentionItems({ reviewQueues: [], behindPrograms: [], incompleteDrafts: [] })).toEqual([]);
  });

  it("drops review queues with zero candidates", () => {
    const result = buildAttentionItems({
      reviewQueues: [{ opportunityId: "o1", role: "Marketing Intern", candidatesToReview: 0 }],
      behindPrograms: [],
      incompleteDrafts: [],
    });
    expect(result).toEqual([]);
  });

  it("sorts review queues before behind-schedule interns before incomplete drafts", () => {
    const result = buildAttentionItems({
      reviewQueues: [{ opportunityId: "o1", role: "Marketing Intern", candidatesToReview: 4 }],
      behindPrograms: [{ offerId: "off1", internName: "Ahmed", role: "Data Analyst Intern" }],
      incompleteDrafts: [{ opportunityId: "o2", role: "Sales Internship" }],
    });
    expect(result.map((r) => r.key)).toEqual(["review-o1", "behind-off1", "draft-o2"]);
  });

  it("pluralizes the submission count correctly", () => {
    const [single] = buildAttentionItems({
      reviewQueues: [{ opportunityId: "o1", role: "R", candidatesToReview: 1 }],
      behindPrograms: [],
      incompleteDrafts: [],
    });
    expect(single.message).toBe("1 challenge submission ready for review");
  });
});
