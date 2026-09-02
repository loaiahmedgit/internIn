import { describe, expect, it } from "vitest";
import { ROLE_INTELLIGENCE_FIXTURES } from "./role-intelligence-fixtures";
import { buildRoleSearchText, normalizeRoleKnowledgeText } from "./role-intelligence-ingestion";
import { RoleKnowledgeProfileSchema } from "./role-intelligence-schemas";

describe("role intelligence ingestion boundary", () => {
  it("keeps every bundled overlay inside the normalized, source-mapped contract", () => {
    for (const profile of ROLE_INTELLIGENCE_FIXTURES) {
      expect(() => RoleKnowledgeProfileSchema.parse(profile)).not.toThrow();
      expect(profile.sourceMappings.length).toBeGreaterThan(0);
    }
  });

  it("builds retrieval text with activities and tasks before titles", () => {
    const profile = ROLE_INTELLIGENCE_FIXTURES.find((candidate) => candidate.id === "erp-implementation-assistant");
    expect(profile).toBeDefined();
    const document = buildRoleSearchText(profile!);
    expect(document.indexOf("activities ")).toBeLessThan(document.indexOf("titles "));
    expect(document).toContain("Data migration");
    expect(document).toContain("SAP");
  });

  it("normalizes source text without losing tool punctuation", () => {
    expect(normalizeRoleKnowledgeText("  C++ / Node.js — APIs ")).toBe("c++ / node.js apis");
  });
});
