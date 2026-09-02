import { describe, expect, it } from "vitest";

import { describeOpportunityEdit, OpportunityEditPatchSchema, opportunityEditEntries } from "./opportunity-edit";

const emptyPatch = {
  role: null,
  department: null,
  shortDescription: null,
  description: null,
  whatYouWillLearn: null,
  requirements: null,
  niceToHave: null,
  duration: null,
  hoursPerWeek: null,
  location: null,
  workMode: null,
  applicationDeadline: null,
  startDate: null,
  slots: null,
  skills: null,
  requireCv: null,
  applicationQuestions: null,
} as const;

describe("OpportunityEditPatchSchema", () => {
  it("accepts a minimal explicit deadline change and leaves every other field unchanged", () => {
    const patch = OpportunityEditPatchSchema.parse({ ...emptyPatch, applicationDeadline: "2026-10-15" });
    expect(opportunityEditEntries(patch)).toEqual([{ field: "applicationDeadline", value: "2026-10-15" }]);
  });

  it("rejects malformed dates and unsafe values", () => {
    expect(() => OpportunityEditPatchSchema.parse({ ...emptyPatch, applicationDeadline: "next Friday" })).toThrow();
    expect(() => OpportunityEditPatchSchema.parse({ ...emptyPatch, applicationDeadline: "2026-02-31" })).toThrow();
    expect(() => OpportunityEditPatchSchema.parse({ ...emptyPatch, hoursPerWeek: 100 })).toThrow();
  });

  it("creates factual before and after rows for the confirmation card", () => {
    const patch = OpportunityEditPatchSchema.parse({ ...emptyPatch, workMode: "remote", skills: ["SQL", "Python"] });
    expect(describeOpportunityEdit(patch, { workMode: "hybrid", skills: ["SQL"] })).toEqual([
      { label: "Work mode", before: "hybrid", after: "remote" },
      { label: "Skills", before: "SQL", after: "SQL, Python" },
    ]);
  });
});
