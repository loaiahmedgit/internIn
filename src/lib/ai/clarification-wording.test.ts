import { describe, expect, it } from "vitest";
import { looksRobotic, groundedClarificationFallback } from "./clarification-wording";

describe("looksRobotic", () => {
  it("accepts repeated modal verbs as grammar rather than repeated domain content", () => {
    expect(looksRobotic("Would they triage requests, or would they respond directly to customers?")).toBe(false);
    expect(looksRobotic("Should they review documents, or should they organize incoming support tickets?")).toBe(false);
  });
  it("flags the exact reported pattern — a significant word repeated across the sentence", () => {
    expect(looksRobotic("Will they mainly track support requests and manage support request queue, or will they also support broader customer support?")).toBe(true);
  });

  it("flags a domain word doubling as both the template connector and the described scope", () => {
    expect(looksRobotic("Will they mainly reconcile transactions, or will they also support broader financial support?")).toBe(true);
  });

  it("does not flag a natural question with each significant word used once", () => {
    expect(looksRobotic("Will they mainly organize and triage incoming support tickets, or also respond directly to customers?")).toBe(false);
  });

  it("does not flag ordinary connector-word repetition (will/they/mainly/or/also)", () => {
    expect(looksRobotic("Will they mainly prepare and validate migration data, or will they also help test and configure the ERP system?")).toBe(false);
  });

  it("does not flag the plain generic fallback question", () => {
    expect(looksRobotic("What kind of work should this person mainly own day to day?")).toBe(false);
  });

  it.each([
    "Will they mainly troubleshoot employee devices, or will they also manage user accounts and broader internal IT operations?",
    "Will they mainly reconcile invoices and transactions, or will they also prepare financial reports and analysis?",
    "Will they mainly create social content, or will they also help plan campaigns and analyze performance?",
    "Will they mainly track inbound shipments, or will they also coordinate delivery schedules and logistics planning?",
    "Will they mainly fix dashboard bugs, or will they also help design new product features?",
  ])("does not flag a naturally varied contrast across domains: %s", (question) => {
    expect(looksRobotic(question)).toBe(false);
  });
});


describe("grounded clarification fallback", () => {
  it("does not invent a concrete broader responsibility on provider failure", () => {
    const result = groundedClarificationFallback("Will they manage support requests, or also support broader customer support?");
    expect(looksRobotic(result)).toBe(false);
    expect(result).toContain("work you've described");
  });
  it("preserves an explicit A-or-B distinction", () => {
    const question = "Will they process invoices, or audit invoices for accuracy?";
    expect(groundedClarificationFallback(question)).toBe(question);
  });
});
