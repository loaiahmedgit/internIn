import { config } from "dotenv";
config({ path: ".env.local" });
import { describe, expect, it } from "vitest";
import { extractWorkNeedProfile } from "./work-need-extraction";
import { recommendRoleFromProfiles } from "./role-intelligence";
import { ROLE_INTELLIGENCE_FIXTURES } from "./role-intelligence-fixtures";

const maybe = process.env.OPENROUTER_API_KEY ? describe : describe.skip;

maybe("role intelligence — live task-first extraction", () => {
  it(
    "extracts ERP migration work and ranks the implementation-support internship first",
    async () => {
      const input = "We need to hire someone to deal with messy operational or financial data and slow transition times when migrating to new enterprise planning systems like SAP or Oracle.";
      const need = await extractWorkNeedProfile(input, `Employer: ${input}`);
      const result = recommendRoleFromProfiles(need, ROLE_INTELLIGENCE_FIXTURES);

      expect(need.activityClarity).toBe("clear");
      expect(need.explicitRoleTitle).toBeNull();
      expect(need.activities.join(" ")).toMatch(/migrat|map|cleans|validat|implement/i);
      expect(need.systemsOrTools.join(" ")).toMatch(/SAP/i);
      expect(need.systemsOrTools.join(" ")).toMatch(/Oracle/i);
      expect(result.recommendedRole?.title).toBe("ERP Implementation Assistant Intern");
    },
    60_000,
  );

  it.each([
    ["IT support", "We need someone fixing employee laptops, printers, and normal software issues.", "IT Support Intern"],
    ["data reporting", "We waste hours cleaning spreadsheets and creating weekly dashboards.", "Data Reporting Analyst Intern"],
    ["frontend development", "We need someone building React interfaces and connecting APIs.", "Frontend Developer Intern"],
    ["accounting", "We need someone reconciling invoices and preparing monthly financial reports.", "Accounting Intern"],
    ["ERP validation", "We need someone helping migrate data to SAP and validate the new ERP system.", "ERP Implementation Assistant Intern"],
  ])(
    "extracts and matches %s work",
    async (_label, input, expected) => {
      const need = await extractWorkNeedProfile(input, `Employer: ${input}`);
      const result = recommendRoleFromProfiles(need, ROLE_INTELLIGENCE_FIXTURES);
      expect(need.activityClarity).toBe("clear");
      expect(result.recommendedRole?.title).toBe(expected);
    },
    60_000,
  );

  it(
    "keeps a bare CRM problem ambiguous",
    async () => {
      const input = "We need help with our CRM.";
      const need = await extractWorkNeedProfile(input, `Employer: ${input}`);
      const result = recommendRoleFromProfiles(need, ROLE_INTELLIGENCE_FIXTURES);

      expect(need.activityClarity).toBe("ambiguous");
      expect(result.clarificationNeeded).toBe(true);
      expect(result.recommendedRole).toBeNull();
    },
    60_000,
  );

  it(
    "preserves a named role unless its work seriously conflicts, then asks before changing it",
    async () => {
      const input = "I need a Graphic Design Intern to write backend APIs in Node.js.";
      const need = await extractWorkNeedProfile(input, `Employer: ${input}`);
      const result = recommendRoleFromProfiles(need, ROLE_INTELLIGENCE_FIXTURES);
      expect(need.explicitRoleTitle?.toLowerCase()).toContain("graphic design");
      expect(result.recommendedRole?.title.toLowerCase()).toContain("graphic design");
      expect(result.clarificationNeeded).toBe(true);
      const alternative = ROLE_INTELLIGENCE_FIXTURES.find((profile) => profile.id === result.alternatives[0]?.roleProfileId);
      expect(alternative?.occupationFamily).toBe("Software Development");
    },
    60_000,
  );
});
