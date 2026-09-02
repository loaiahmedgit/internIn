import { config } from "dotenv";
config({ path: ".env.local" });
import { describe, expect, it } from "vitest";
import { workActivitySignals } from "./role-intelligence-schemas";
import { extractWorkNeedProfile } from "./work-need-extraction";

const maybe = process.env.OPENROUTER_API_KEY && process.env.RUN_ROLE_HELDOUT_LIVE === "1"
  ? describe
  : describe.skip;

const CLEAR_CASES = [
  ["software", "Our checkout flow needs two responsive browser screens wired to existing service endpoints.", /software|web|application|frontend/i, /interface|screen|endpoint|api/i],
  ["IT support", "Staff keep losing network access on their workstations and new laptops need to be configured.", /information technology|IT support|computer|technical support/i, /network|workstation|laptop|configur/i],
  ["accounting", "Supplier payments do not match their invoices and the month-end ledger needs checking.", /account|finance|bookkeep/i, /invoice|payment|ledger|reconcil/i],
  ["reporting", "Leadership needs a recurring dashboard built from several inconsistent reporting files.", /data|report|business intelligence|analytics/i, /dashboard|clean|validat|report/i],
  ["enterprise systems", "A legacy business platform is being replaced and its fields must be mapped and tested in the new system.", /enterprise|business system|implementation|migration/i, /map|migrat|test|validat/i],
  ["pharmacy operations", "Medicine stock records need an expiry audit and discrepancies must be documented safely.", /pharmacy|healthcare|medication|medicine/i, /stock|inventory|expiry|document/i],
  ["logistics", "Inbound freight is arriving without reliable status updates or coordinated delivery windows.", /logistic|supply chain|transport|freight/i, /shipment|freight|delivery|track|coordinat/i],
  ["manufacturing", "A production line has recurring product defects that need inspection records and pattern analysis.", /manufactur|production|quality/i, /defect|inspect|quality|analy/i],
  ["architecture", "Site measurements need to be reflected in CAD plans and an updated drawing package.", /architect|built environment|building|construction|CAD|drawing|site measurement/i, /CAD|drawing|plan|site/i],
  ["marketing", "A product campaign needs content scheduled and its audience engagement summarized.", /market|communication|campaign/i, /content|campaign|engagement|schedul/i],
  ["HR", "New-starter records and interview calendars are inconsistent across the people team.", /human resource|people|recruit|employment|onboard|interview/i, /onboard|new-starter|interview|record|calendar/i],
  ["customer support", "Customer tickets repeat the same unresolved questions and the help centre is out of date.", /customer service|customer support/i, /ticket|issue|help|knowledge/i],
  ["sales operations", "Opportunity records are unreliable, so the revenue pipeline forecast keeps changing.", /sales|revenue|commercial operation/i, /pipeline|forecast|opportunity|record/i],
  ["operations", "An internal approval process takes too long and nobody has documented its handoffs.", /business operation|process|operational/i, /workflow|process|handoff|document|cycle/i],
] as const;

const AMBIGUOUS_CASES = [
  "We need help with an internal platform.",
  "Our team has a records problem.",
  "Customer work is taking too long.",
] as const;

const EXPLICIT_CASES = [
  ["Digital Accessibility Intern", "I need a Digital Accessibility Intern to review our interfaces."],
  ["Community Partnerships Intern", "Please help me hire a Community Partnerships Intern for partner outreach."],
] as const;

async function inBatches<T, R>(values: readonly T[], size: number, operation: (value: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < values.length; index += size) {
    results.push(...await Promise.all(values.slice(index, index + size).map(operation)));
  }
  return results;
}

maybe("work-need extraction held-out generalization — live model", () => {
  it("preserves domain/activity evidence, ambiguity, and explicit titles across domains", async () => {
    const clearResults = await inBatches(CLEAR_CASES, 4, async ([label, input, domainPattern, activityPattern]) => {
      const profile = await extractWorkNeedProfile(input, `Employer: ${input}`);
      return {
        label,
        domainCorrect: domainPattern.test(profile.domainSignals.join(" ")),
        activityRelevant: activityPattern.test(workActivitySignals(profile).join(" ")),
        clear: profile.activityClarity === "clear",
      };
    });
    const ambiguousResults = await inBatches(AMBIGUOUS_CASES, 3, async (input) => {
      const profile = await extractWorkNeedProfile(input, `Employer: ${input}`);
      return profile.activityClarity === "ambiguous";
    });
    const explicitResults = await inBatches(EXPLICIT_CASES, 2, async ([title, input]) => {
      const profile = await extractWorkNeedProfile(input, `Employer: ${input}`);
      return profile.explicitRoleTitle?.toLocaleLowerCase("en") === title.toLocaleLowerCase("en");
    });

    const metrics = {
      cases: clearResults.length,
      domainSignalRate: clearResults.filter((result) => result.domainCorrect).length / clearResults.length,
      activitySignalRate: clearResults.filter((result) => result.activityRelevant).length / clearResults.length,
      clearWorkRate: clearResults.filter((result) => result.clear).length / clearResults.length,
      ambiguousCases: ambiguousResults.length,
      ambiguityAccuracy: ambiguousResults.filter(Boolean).length / ambiguousResults.length,
      explicitCases: explicitResults.length,
      explicitTitlePreservation: explicitResults.filter(Boolean).length / explicitResults.length,
    };
    console.info("WORK_NEED_HELD_OUT_LIVE_METRICS", JSON.stringify(metrics));
    console.info("WORK_NEED_HELD_OUT_LIVE_FAILURES", JSON.stringify(clearResults.filter((result) => !result.domainCorrect || !result.activityRelevant || !result.clear)));

    expect(metrics.domainSignalRate).toBeGreaterThanOrEqual(0.85);
    expect(metrics.activitySignalRate).toBeGreaterThanOrEqual(0.85);
    expect(metrics.clearWorkRate).toBeGreaterThanOrEqual(0.85);
    expect(metrics.ambiguityAccuracy).toBe(1);
    expect(metrics.explicitTitlePreservation).toBe(1);
  }, 180_000);
});
