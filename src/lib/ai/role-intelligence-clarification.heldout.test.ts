import { describe, expect, it } from "vitest";
import { recommendRoleFromProfiles } from "./role-intelligence";
import { WorkNeedProfileSchema, type RoleKnowledgeProfile, type WorkNeedProfile } from "./role-intelligence-schemas";

/**
 * Targets one regression only: the clarification asked AFTER role
 * discovery abstains, not role discovery itself (role accuracy is covered
 * by role-intelligence.heldout.test.ts). Held out from the production
 * fixtures and from role-intelligence.heldout.test.ts's own corpus so
 * nothing here can be satisfied by memorizing either.
 */
function need(overrides: Partial<WorkNeedProfile>): WorkNeedProfile {
  return WorkNeedProfileSchema.parse({
    originalRequest: "The company described a work problem.",
    explicitRoleTitle: null,
    problems: [],
    activities: [],
    domainSignals: [],
    systemsOrTools: [],
    desiredOutcomes: [],
    constraints: [],
    activityClarity: "ambiguous",
    domainClarity: "clear",
    seniorityIntent: "intern/junior",
    ...overrides,
  });
}

const GENERIC = "What kind of work should this person mainly own day to day?";

/**
 * Weak/empty retrieval (no candidate profiles at all) is the exact
 * production symptom this fixes: real domain/work evidence was extracted,
 * but nothing usable came back from the knowledge base, so the app used to
 * discard that evidence for the one-size-fits-all fallback line.
 */
const NO_RETRIEVAL: RoleKnowledgeProfile[] = [];

describe("clarification quality after role-discovery abstention (held out)", () => {
  it.each([
    {
      domain: "healthcare operations",
      workNeed: need({
        originalRequest: "We need help with medication inventory records that are often inconsistent, causing stock discrepancies and making it harder to track expiry dates and restocking needs.",
        problems: ["medication inventory records are inconsistent", "stock discrepancies"],
        activities: ["track medication expiry dates", "manage restocking"],
        domainSignals: ["pharmacy operations", "medication inventory"],
        desiredOutcomes: ["accurate inventory records"],
      }),
      expectSubstringOneOf: ["pharmacy", "medication", "inventory", "expiry", "restock"],
    },
    {
      domain: "ERP/business systems",
      workNeed: need({
        originalRequest: "We're moving our HR records from spreadsheets into Workday and need help mapping fields, cleaning up employee data, and testing before go-live.",
        problems: ["employee data needs cleaning before go-live"],
        activities: ["map HR fields to Workday", "test the new system before go-live"],
        domainSignals: ["Workday implementation", "HR systems"],
        systemsOrTools: ["Workday"],
      }),
      expectSubstringOneOf: ["workday", "field", "hr system", "go-live", "map"],
    },
    {
      domain: "IT support",
      workNeed: need({
        originalRequest: "Our office laptops keep breaking and staff keep locking themselves out of accounts.",
        problems: ["laptops keep breaking", "staff lock themselves out of accounts"],
        activities: ["reset employee passwords", "troubleshoot broken laptops"],
        domainSignals: ["office IT support"],
      }),
      expectSubstringOneOf: ["laptop", "password", "account", "it support"],
    },
    {
      domain: "finance/accounting",
      workNeed: need({
        originalRequest: "We want an intern to reconcile our monthly bank statements, chase overdue client invoices, and keep our expense spreadsheets accurate.",
        problems: ["bank statements need reconciliation", "client invoices are overdue"],
        activities: ["reconcile monthly bank statements", "follow up on overdue invoices"],
        domainSignals: ["bookkeeping", "accounts receivable"],
      }),
      expectSubstringOneOf: ["bank", "reconcil", "invoice", "bookkeeping", "receivable"],
    },
    {
      domain: "marketing",
      workNeed: need({
        originalRequest: "Our social posts go out inconsistently and we can't tell which campaigns are actually working.",
        problems: ["social posts go out inconsistently", "campaign performance is unclear"],
        activities: ["schedule social posts", "track campaign performance"],
        domainSignals: ["social media marketing", "campaign analytics"],
      }),
      expectSubstringOneOf: ["social", "campaign", "marketing", "analytic"],
    },
    {
      domain: "logistics",
      workNeed: need({
        originalRequest: "We keep losing track of inbound shipments and delivery schedules slip constantly.",
        problems: ["inbound shipments are hard to track", "delivery schedules slip"],
        activities: ["track inbound shipments", "coordinate delivery schedules"],
        domainSignals: ["logistics coordination"],
      }),
      expectSubstringOneOf: ["shipment", "delivery", "logistic", "schedule"],
    },
    {
      domain: "HR",
      workNeed: need({
        originalRequest: "Onboarding paperwork for new hires is scattered across emails and nothing is tracked centrally.",
        problems: ["onboarding paperwork is scattered", "nothing is tracked centrally"],
        activities: ["organize onboarding paperwork", "track new-hire status centrally"],
        domainSignals: ["employee onboarding"],
      }),
      expectSubstringOneOf: ["onboard", "new hire", "paperwork", "hr"],
    },
    {
      domain: "software",
      workNeed: need({
        originalRequest: "Our internal dashboard has UI bugs and the API integration breaks whenever the vendor changes their schema.",
        problems: ["dashboard has UI bugs", "API integration breaks on schema changes"],
        activities: ["fix dashboard UI bugs", "stabilize the API integration"],
        domainSignals: ["frontend development", "API integration"],
      }),
      expectSubstringOneOf: ["dashboard", "ui", "api", "integration"],
    },
    {
      domain: "operations",
      workNeed: need({
        originalRequest: "Our internal approval workflow has too many manual handoffs and nobody has documented how it actually works.",
        problems: ["approval workflow has manual handoffs", "workflow is undocumented"],
        activities: ["map the approval workflow", "document the process"],
        domainSignals: ["process improvement"],
      }),
      expectSubstringOneOf: ["approval", "workflow", "handoff", "process"],
    },
  ])(
    "asks a discriminating contrast grounded in the employer's own $domain evidence, not a generic fallback or a bare restatement",
    ({ workNeed, expectSubstringOneOf }) => {
      const result = recommendRoleFromProfiles(workNeed, NO_RETRIEVAL);

      expect(result.recommendedRole).toBeNull();
      expect(result.clarificationNeeded).toBe(true);
      expect(result.clarificationQuestion).not.toBe(GENERIC);
      expect(result.clarificationQuestion).not.toBeNull();
      const raw = result.clarificationQuestion ?? "";
      // The banned pattern: repeating extracted phrases back and appending
      // a generic tail question adds no discrimination between role
      // boundaries — a real clarification must contrast two possibilities.
      expect(raw).not.toMatch(/^you mentioned/i);
      expect(raw).toMatch(/will they mainly/i);
      expect(raw).toMatch(/\bor\b/i);
      const question = raw.toLocaleLowerCase("en");
      expect(expectSubstringOneOf.some((needle) => question.includes(needle))).toBe(true);
    },
  );

  it("still abstains with the plain generic question when there is no real evidence at all (no false grounding)", () => {
    const result = recommendRoleFromProfiles(
      need({
        originalRequest: "We need somebody to help out.",
        problems: ["We need somebody to help out."],
      }),
      NO_RETRIEVAL,
    );

    expect(result.clarificationNeeded).toBe(true);
    expect(result.clarificationQuestion).toBe(GENERIC);
  });

  it("prefers a real discriminating choice between two coherent nearby roles over a grounded restatement", () => {
    const empty = { alternateTitles: [], workEnvironments: [], competencies: [], safetyConstraints: [], sourceMappings: [] } satisfies Partial<RoleKnowledgeProfile>;
    const inventoryFocused: RoleKnowledgeProfile = {
      ...empty,
      id: "pharmacy-inventory",
      kind: "internship_overlay",
      canonicalTitle: "Pharmacy Inventory Assistant",
      internshipTitle: "Pharmacy Inventory Assistant Intern",
      occupationFamily: "Pharmacy and Healthcare Operations",
      description: "Provides junior-level support for pharmacy inventory work.",
      typicalTasks: ["Reconcile medication inventory counts", "Track expiry dates and stock levels", "Flag restocking needs"],
      workActivities: ["Medication inventory control", "Expiry date tracking", "Restocking coordination"],
      skills: ["Medication inventory control", "Expiry date tracking"],
      knowledge: ["Pharmacy operations"],
      commonTools: ["Pharmacy inventory system"],
      typicalDeliverables: ["Inventory reconciliation report"],
    };
    const broaderOperations: RoleKnowledgeProfile = {
      ...empty,
      id: "pharmacy-operations",
      kind: "internship_overlay",
      canonicalTitle: "Pharmacy Operations Assistant",
      internshipTitle: "Pharmacy Operations Assistant Intern",
      occupationFamily: "Pharmacy and Healthcare Operations",
      description: "Provides junior-level support for broader pharmacy operations.",
      typicalTasks: ["Reconcile medication inventory counts", "Support daily pharmacy workflow", "Document dispensing workflow exceptions"],
      workActivities: ["Medication inventory control", "Pharmacy workflow support", "Dispensing documentation"],
      skills: ["Medication inventory control", "Pharmacy workflow support"],
      knowledge: ["Pharmacy operations"],
      commonTools: ["Pharmacy inventory system"],
      typicalDeliverables: ["Exception log"],
    };

    const result = recommendRoleFromProfiles(
      need({
        originalRequest: "We need help with medication inventory in our pharmacy.",
        problems: ["medication inventory needs help"],
        activities: ["reconcile medication inventory counts"],
        domainSignals: ["pharmacy operations"],
      }),
      [inventoryFocused, broaderOperations],
    );

    expect(result.recommendedRole).toBeNull();
    expect(result.clarificationNeeded).toBe(true);
    const question = result.clarificationQuestion ?? "";
    expect(question).toMatch(/mainly/i);
    expect(question).toMatch(/\bor\b/i);
    expect(question.toLocaleLowerCase("en")).not.toContain("diagnos");
    expect(question.toLocaleLowerCase("en")).not.toContain("prescri");
  });

  describe("wording quality", () => {
    it.each([
      {
        domain: "pharmacy (formal verbs)",
        workNeed: need({
          activities: ["audit medication inventory records", "reconcile stock discrepancies", "track medication expiry dates"],
          domainSignals: ["pharmacy operations"],
        }),
      },
      {
        domain: "logistics (formal verbs)",
        workNeed: need({
          activities: ["oversee warehouse compliance checks", "administer safety documentation"],
          domainSignals: ["logistics compliance"],
        }),
      },
      {
        domain: "ERP/business systems",
        workNeed: need({
          problems: ["employee data needs cleaning before go-live"],
          activities: ["map HR fields to Workday", "test the new system before go-live"],
          // "Workday implementation" is filler-only over this narrow work
          // (see the material-difference tests below) — "ERP program
          // delivery" is the genuinely distinct one that should win.
          domainSignals: ["Workday implementation", "ERP program delivery"],
        }),
      },
      {
        domain: "IT support",
        workNeed: need({
          activities: ["reset employee passwords", "troubleshoot broken laptops"],
          domainSignals: ["office IT support"],
        }),
      },
    ])(
      "prefers a domain-labeled broader phrase over generic 'in this area' wording for $domain, and never reintroduces a formal verb it should have softened",
      ({ workNeed }) => {
        const result = recommendRoleFromProfiles(workNeed, []);
        const question = result.clarificationQuestion ?? "";

        // A reliable domain signal exists in every case above, so the
        // question must name it instead of falling back to the fully
        // generic "responsibilities in this area" tail.
        expect(question).not.toMatch(/responsibilities in this area/i);
        expect(question).toMatch(/broader/i);
        // Grounded: still traces back to the extracted domain vocabulary,
        // not an invented one.
        const lower = question.toLocaleLowerCase("en");
        expect(workNeed.domainSignals.some((signal) => lower.includes(signal.toLocaleLowerCase("en").split(/\s+/u)[0]))).toBe(true);
        // Verb-register map applies generally — it has no idea these are
        // pharmacy/logistics activities, only that "audit"/"oversee"/
        // "administer" have a plainer equivalent.
        expect(question).not.toMatch(/\baudit(s|ing)?\b/i);
        expect(question).not.toMatch(/\boversee(s|ing)?\b/i);
        expect(question).not.toMatch(/\badminister(s|ing)?\b/i);
      },
    );

    it("does not invent a suffix when the domain signal already reads as an organizational noun", () => {
      const result = recommendRoleFromProfiles(
        need({
          activities: ["clean opportunity records", "track pipeline movement"],
          domainSignals: ["sales operations and revenue process"],
        }),
        [],
      );
      const question = result.clarificationQuestion ?? "";
      expect(question.toLocaleLowerCase("en")).not.toMatch(/operations operations|operations and revenue process operations/i);
    });
  });

  describe("material-difference validation (both sides of a contrast must be a genuinely different role scope)", () => {
    it.each([
      {
        domain: "healthcare/pharmacy operations",
        // The exact reported bug: only a domainSignal that is a parent
        // label of the same narrow work is available.
        workNeed: need({
          activities: ["reconcile medication inventory records", "track medication expiry dates", "monitor restocking needs"],
          domainSignals: ["medication inventory management"],
        }),
        bannedPhrase: /medication inventory management/i,
      },
      {
        domain: "healthcare/pharmacy operations (caught live in production)",
        // "stock" appears only in `problems`, not in the narrow activities
        // list used for the question's display text — the domain signal
        // still names the same work, just via a `problems`-only word.
        workNeed: need({
          problems: ["medication inventory records are inconsistent", "stock discrepancies"],
          activities: ["reconcile medication inventory records", "track medication expiry dates", "monitor restocking needs"],
          domainSignals: ["stock management"],
        }),
        bannedPhrase: /stock management/i,
      },
      {
        domain: "finance/accounting (caught live in production)",
        // Same pattern with completely different vocabulary: "accounts
        // payable" IS the narrow work (processing vendor invoices,
        // matching receipts to purchase orders), not a wider field around
        // it, even though it shares no tokens with the activity phrasing.
        workNeed: need({
          problems: ["accounts payable process is a mess", "vendor invoices are paid late", "receipts don't match purchase orders"],
          activities: ["process vendor invoices", "match receipts to purchase orders"],
          domainSignals: ["accounts payable"],
        }),
        bannedPhrase: /accounts payable/i,
      },
      {
        domain: "IT support",
        workNeed: need({
          activities: ["troubleshoot employee laptops", "resolve login issues"],
          domainSignals: ["laptop and login troubleshooting"],
        }),
        bannedPhrase: /laptop and login troubleshooting/i,
      },
      {
        domain: "ERP/business systems",
        workNeed: need({
          activities: ["map HR fields to Workday", "test the new system before go-live"],
          domainSignals: ["Workday implementation"],
        }),
        bannedPhrase: /workday implementation/i,
      },
      {
        domain: "finance/accounting",
        workNeed: need({
          activities: ["reconcile monthly bank statements", "follow up on overdue invoices"],
          domainSignals: ["bank statement and invoice reconciliation"],
        }),
        bannedPhrase: /bank statement and invoice reconciliation/i,
      },
      {
        domain: "marketing",
        workNeed: need({
          activities: ["schedule social posts", "track campaign performance"],
          domainSignals: ["social post scheduling and performance tracking"],
        }),
        bannedPhrase: /social post scheduling and performance tracking/i,
      },
      {
        domain: "logistics",
        workNeed: need({
          activities: ["track inbound shipments", "coordinate delivery schedules"],
          domainSignals: ["shipment and delivery coordination"],
        }),
        bannedPhrase: /shipment and delivery coordination/i,
      },
      {
        domain: "HR",
        workNeed: need({
          activities: ["organize onboarding paperwork", "track new-hire status"],
          domainSignals: ["new-hire onboarding administration"],
        }),
        bannedPhrase: /new-hire onboarding administration/i,
      },
      {
        domain: "software",
        workNeed: need({
          activities: ["fix dashboard UI bugs", "stabilize the API integration"],
          domainSignals: ["dashboard and API bug fixing"],
        }),
        bannedPhrase: /dashboard and api bug fixing/i,
      },
      {
        domain: "operations",
        workNeed: need({
          activities: ["map the approval workflow", "document the process"],
          domainSignals: ["approval workflow documentation"],
        }),
        bannedPhrase: /approval workflow documentation/i,
      },
    ])(
      "rejects a $domain 'broader' phrase that is only a paraphrase of the narrow cluster (A must differ from B in role scope)",
      ({ workNeed, bannedPhrase }) => {
        const result = recommendRoleFromProfiles(workNeed, []);
        const question = result.clarificationQuestion ?? "";
        // The fake-specific label must never appear...
        expect(question).not.toMatch(bannedPhrase);
        // ...and the question must still be a real, answerable one: either
        // the honest generic floor, or the plain fallback — never nothing.
        expect(question.length).toBeGreaterThan(0);
      },
    );

    it("still uses a domain label when it is genuinely a different, wider scope than the narrow cluster", () => {
      const result = recommendRoleFromProfiles(
        need({
          activities: ["track medication expiry dates", "manage restocking"],
          problems: ["medication inventory records are inconsistent"],
          domainSignals: ["pharmacy operations", "medication inventory"],
        }),
        [],
      );
      const question = result.clarificationQuestion ?? "";
      expect(question).toMatch(/broader pharmacy operations/i);
    });

    it("recommends directly instead of asking a fake clarification when only one role family is supported and no genuinely different second scope exists", () => {
      const empty = { alternateTitles: [], workEnvironments: [], competencies: [], safetyConstraints: [], sourceMappings: [] } satisfies Partial<RoleKnowledgeProfile>;
      const onlyFamily: RoleKnowledgeProfile = {
        ...empty,
        id: "pharmacy-inventory-only",
        kind: "internship_overlay",
        canonicalTitle: "Pharmacy Inventory Assistant",
        internshipTitle: "Pharmacy Inventory Assistant Intern",
        occupationFamily: "Pharmacy and Healthcare Operations",
        description: "Provides junior-level support for pharmacy inventory work.",
        typicalTasks: ["Reconcile medication inventory counts", "Track expiry dates and stock levels"],
        workActivities: ["Medication inventory control", "Expiry date tracking"],
        skills: ["Medication inventory control", "Expiry date tracking"],
        knowledge: ["Pharmacy operations"],
        commonTools: ["Pharmacy inventory system"],
        typicalDeliverables: ["Inventory reconciliation report"],
      };

      const result = recommendRoleFromProfiles(
        need({
          activityClarity: "clear",
          activities: ["reconcile medication inventory counts", "track expiry dates"],
          domainSignals: ["medication inventory management"],
        }),
        [onlyFamily],
      );

      // Only one coherent family was ever retrieved, and the only domain
      // signal is a paraphrase of the same work — there is no genuine
      // second scope to ask about, so this should recommend rather than
      // force a fake "inventory work, or broader inventory work?" choice.
      expect(result.clarificationNeeded).toBe(false);
      expect(result.recommendedRole).not.toBeNull();
      expect(result.recommendedRole?.title).toBe("Pharmacy Inventory Assistant Intern");
    });

    it("still asks when two genuinely different coherent role families are retrieved", () => {
      const empty = { alternateTitles: [], workEnvironments: [], competencies: [], safetyConstraints: [], sourceMappings: [] } satisfies Partial<RoleKnowledgeProfile>;
      const inventoryFocused: RoleKnowledgeProfile = {
        ...empty,
        id: "pharmacy-inventory-2",
        kind: "internship_overlay",
        canonicalTitle: "Pharmacy Inventory Assistant",
        internshipTitle: "Pharmacy Inventory Assistant Intern",
        occupationFamily: "Pharmacy and Healthcare Operations",
        description: "Provides junior-level support for pharmacy inventory work.",
        typicalTasks: ["Reconcile medication inventory counts", "Track expiry dates and stock levels", "Flag restocking needs"],
        workActivities: ["Medication inventory control", "Expiry date tracking", "Restocking coordination"],
        skills: ["Medication inventory control", "Expiry date tracking"],
        knowledge: ["Pharmacy operations"],
        commonTools: ["Pharmacy inventory system"],
        typicalDeliverables: ["Inventory reconciliation report"],
      };
      const broaderOperations: RoleKnowledgeProfile = {
        ...empty,
        id: "pharmacy-operations-2",
        kind: "internship_overlay",
        canonicalTitle: "Pharmacy Operations Assistant",
        internshipTitle: "Pharmacy Operations Assistant Intern",
        occupationFamily: "Pharmacy and Healthcare Operations",
        description: "Provides junior-level support for broader pharmacy operations.",
        typicalTasks: ["Reconcile medication inventory counts", "Support daily pharmacy workflow", "Document dispensing workflow exceptions"],
        workActivities: ["Medication inventory control", "Pharmacy workflow support", "Dispensing documentation"],
        skills: ["Medication inventory control", "Pharmacy workflow support"],
        knowledge: ["Pharmacy operations"],
        commonTools: ["Pharmacy inventory system"],
        typicalDeliverables: ["Exception log"],
      };

      const result = recommendRoleFromProfiles(
        need({
          activities: ["reconcile medication inventory counts"],
          domainSignals: ["pharmacy operations"],
        }),
        [inventoryFocused, broaderOperations],
      );

      expect(result.clarificationNeeded).toBe(true);
      expect(result.recommendedRole).toBeNull();
      expect(result.clarificationQuestion).toMatch(/mainly/i);
    });

    it("preserves an explicit employer role even when no adjacent scope can be validated", () => {
      const result = recommendRoleFromProfiles(
        need({
          explicitRoleTitle: "Pharmacy Inventory Intern",
          activityClarity: "clear",
          activities: ["reconcile medication inventory records"],
          domainSignals: ["medication inventory management"],
        }),
        [],
      );
      expect(result.roleSource).toBe("explicit");
      expect(result.recommendedRole?.title).toBe("Pharmacy Inventory Intern");
      expect(result.clarificationNeeded).toBe(false);
    });
  });
});
