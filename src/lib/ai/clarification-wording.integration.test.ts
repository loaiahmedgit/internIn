import { config } from "dotenv";
config({ path: ".env.local" });
import { describe, expect, it } from "vitest";
import { naturalizeClarificationQuestion, looksRobotic } from "./clarification-wording";

const maybe = process.env.OPENROUTER_API_KEY ? describe : describe.skip;

/**
 * Live model quality evaluation across domains the implementation was NOT
 * tuned against — the point is generalization of the surface-realization
 * rewrite, not passing one exact provided sentence.
 */
maybe("clarification wording — live naturalization across domains", () => {
  it.each([
    {
      domain: "customer support",
      raw: "Will they mainly track support requests and manage support request queue, or will they also support broader customer support?",
    },
    {
      domain: "IT",
      raw: "Will they mainly reset employee passwords and troubleshoot broken laptops, or will they also support broader office IT support?",
    },
    {
      domain: "finance",
      raw: "Will they mainly process vendor invoices and match receipts to purchase orders, or will they also support broader finance operations?",
    },
    {
      domain: "ERP",
      raw: "Will they mainly map HR fields to Workday and test the new system before go-live, or will they also support broader ERP program delivery?",
    },
    {
      domain: "healthcare operations",
      raw: "Will they mainly reconcile medication inventory records, track medication expiry dates, and monitor restocking needs, or will they also support broader healthcare operations?",
    },
    {
      domain: "marketing",
      raw: "Will they mainly schedule social posts and track campaign performance, or will they also support broader marketing operations?",
    },
    {
      domain: "logistics",
      raw: "Will they mainly track inbound shipments and coordinate delivery schedules, or take on broader responsibilities in this area?",
    },
    {
      domain: "software",
      raw: "Will they mainly fix dashboard UI bugs and stabilize the API integration, or take on broader responsibilities in this area?",
    },
  ])("naturalizes the $domain clarification without repeating a significant word", async ({ raw }) => {
    const result = await naturalizeClarificationQuestion(raw);

    // Real question, one sentence, still a question. No requirement on
    // its exact opening or grammatical shape — only that it stays a real,
    // in-domain A-or-B contrast.
    expect(result.length).toBeGreaterThan(10);
    expect(result.trim().endsWith("?")).toBe(true);
    // The exact "database fields concatenated" smell must be gone.
    expect(looksRobotic(result)).toBe(false);
    // Still an actual contrast, not a single flat statement.
    expect(result).toMatch(/\bor\b/i);
  }, 30_000);

  it(
    "varies its sentence opening across different clarifications instead of defaulting to the same construction every time",
    async () => {
      const rawQuestions = [
        "Will they mainly track support requests and manage support request queue, or will they also support broader customer support?",
        "Will they mainly reset employee passwords and troubleshoot broken laptops, or will they also support broader office IT support?",
        "Will they mainly process vendor invoices and match receipts to purchase orders, or will they also support broader finance operations?",
        "Will they mainly reconcile medication inventory records, track medication expiry dates, and monitor restocking needs, or will they also support broader healthcare operations?",
        "Will they mainly schedule social posts and track campaign performance, or will they also support broader marketing operations?",
        "Will they mainly track inbound shipments and coordinate delivery schedules, or take on broader responsibilities in this area?",
      ];
      const results = await Promise.all(rawQuestions.map((raw) => naturalizeClarificationQuestion(raw)));
      const openings = results.map((question) => question.trim().split(/\s+/u).slice(0, 3).join(" ").toLocaleLowerCase("en"));

      // Not asserting any SPECIFIC opening is used or avoided — only that
      // the model isn't collapsing every rewrite onto one identical
      // construction, which is the actual reported problem.
      expect(new Set(openings).size).toBeGreaterThan(1);
    },
    60_000,
  );
});
