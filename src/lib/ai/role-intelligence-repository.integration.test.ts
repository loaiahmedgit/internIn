import { config } from "dotenv";
config({ path: ".env.local" });
import { describe, expect, it } from "vitest";
import { recommendRoleFromKnowledgeBase, retrieveRoleProfiles } from "./role-intelligence-repository";
import { WorkNeedProfileSchema } from "./role-intelligence-schemas";

const maybe = process.env.DATABASE_URL ? describe : describe.skip;

maybe("role intelligence — local Postgres retrieval", () => {
  it("retrieves task evidence from the seeded knowledge base and ranks ERP implementation first", async () => {
    const need = WorkNeedProfileSchema.parse({
      originalRequest: "We need help cleaning and mapping data for an SAP migration.",
      explicitRoleTitle: null,
      problems: ["messy migration data"],
      activities: ["data cleansing", "data mapping", "migration validation"],
      systemsOrTools: ["SAP"],
      desiredOutcomes: ["fewer migration issues"],
      constraints: [],
      activityClarity: "clear",
      seniorityIntent: "intern/junior",
    });

    const profiles = await retrieveRoleProfiles(need);
    expect(profiles.some((profile) => profile.id === "erp-implementation-assistant")).toBe(true);
    const result = await recommendRoleFromKnowledgeBase(need);
    expect(result.recommendedRole?.title).toBe("ERP Implementation Assistant Intern");
  }, 30_000);
});
