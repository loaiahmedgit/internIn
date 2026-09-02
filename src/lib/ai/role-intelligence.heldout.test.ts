import { describe, expect, it } from "vitest";
import { recommendRoleFromProfiles } from "./role-intelligence";
import { WorkNeedProfileSchema, type RoleKnowledgeProfile, type WorkNeedProfile } from "./role-intelligence-schemas";

const empty = {
  alternateTitles: [],
  workEnvironments: [],
  competencies: [],
  safetyConstraints: [],
  sourceMappings: [],
} satisfies Partial<RoleKnowledgeProfile>;

function role(
  id: string,
  title: string,
  family: string,
  tasks: string[],
  activities: string[],
  knowledge: string[],
  tools: string[],
  deliverables: string[],
): RoleKnowledgeProfile {
  return {
    ...empty,
    id,
    kind: "internship_overlay",
    canonicalTitle: title,
    internshipTitle: `${title} Intern`,
    occupationFamily: family,
    description: `Provides junior-level support for ${family.toLocaleLowerCase("en")} work.`,
    typicalTasks: tasks,
    workActivities: activities,
    skills: activities,
    knowledge,
    commonTools: tools,
    typicalDeliverables: deliverables,
  };
}

/**
 * Evaluation-only corpus. It is deliberately separate from runtime fixtures:
 * changing these profiles cannot improve production retrieval by memorizing a
 * test title, and the assertions below judge families and work evidence.
 */
const HELD_OUT_PROFILES: RoleKnowledgeProfile[] = [
  role("software", "Application Developer", "Software Development", ["Implement web user interfaces", "Integrate service APIs", "Test application behavior"], ["Software development", "Interface implementation", "API integration"], ["Web applications", "Software engineering"], ["JavaScript", "Git", "REST API"], ["Working application feature"]),
  role("it-support", "Technical Support Assistant", "Information Technology Support", ["Diagnose workstation failures", "Resolve network connectivity issues", "Set up employee devices"], ["Technical troubleshooting", "End-user support", "Device configuration"], ["Computer hardware", "Operating systems", "Computer networks"], ["Ticketing system", "Windows", "macOS"], ["Resolved support ticket"]),
  role("finance", "Accounting Assistant", "Accounting and Finance", ["Reconcile supplier invoices and payments", "Check ledger entries", "Prepare month-end statements"], ["Account reconciliation", "Bookkeeping", "Financial reporting"], ["Accounting", "Financial statements"], ["Accounting software", "Spreadsheet"], ["Reconciliation schedule"]),
  role("reporting", "Reporting Analyst", "Data and Business Intelligence", ["Clean reporting datasets", "Build recurring dashboards", "Validate reporting totals"], ["Data cleaning", "Dashboard development", "Business reporting"], ["Data quality", "Business intelligence"], ["Spreadsheet", "Dashboard software"], ["Management dashboard"]),
  role("enterprise-systems", "Business Systems Implementation Assistant", "Enterprise Systems Implementation", ["Prepare source records for migration", "Map legacy fields to a target system", "Validate migrated records", "Track implementation issues"], ["System implementation", "Data mapping", "Migration validation"], ["Enterprise business systems", "Data migration"], ["ERP platform", "Issue tracker"], ["Field mapping specification", "Migration test log"]),
  role("pharmacy", "Pharmacy Operations Assistant", "Pharmacy and Healthcare Operations", ["Reconcile medicine stock records", "Check expiry and storage records", "Document dispensing workflow exceptions"], ["Medication inventory control", "Pharmacy operations", "Healthcare record compliance"], ["Pharmacy operations", "Medication safety"], ["Pharmacy inventory system"], ["Expiry audit", "Inventory exception log"]),
  role("logistics", "Logistics Coordinator", "Logistics and Supply Chain", ["Track inbound shipments", "Coordinate delivery schedules", "Prepare freight documents"], ["Shipment tracking", "Delivery coordination", "Freight documentation"], ["Transportation", "Supply chain operations"], ["Transportation management system"], ["Shipment status report"]),
  role("manufacturing", "Production Quality Assistant", "Manufacturing and Quality", ["Inspect product defects", "Record production-line quality results", "Analyze recurring defect patterns"], ["Quality inspection", "Production monitoring", "Defect analysis"], ["Manufacturing processes", "Quality assurance"], ["Quality management system"], ["Inspection report", "Defect log"]),
  role("architecture", "Architectural Design Assistant", "Architecture and Built Environment", ["Prepare CAD drawings", "Update building plans from site measurements", "Create design presentation boards"], ["Architectural drafting", "Site documentation", "Spatial design"], ["Building design", "Construction documentation"], ["CAD software", "Building information modeling"], ["Drawing set"]),
  role("marketing", "Marketing Campaign Assistant", "Marketing and Communications", ["Draft campaign content", "Coordinate publishing schedules", "Review campaign engagement"], ["Campaign coordination", "Content marketing", "Marketing performance tracking"], ["Marketing communications", "Audience engagement"], ["Content calendar", "Analytics platform"], ["Campaign report"]),
  role("hr", "People Operations Assistant", "Human Resources", ["Maintain onboarding records", "Coordinate interview schedules", "Prepare employee documentation"], ["Employee onboarding", "Recruitment coordination", "Personnel records administration"], ["Human resources", "Employment processes"], ["Applicant tracking system", "HR information system"], ["Onboarding checklist"]),
  role("customer-support", "Customer Support Assistant", "Customer Service", ["Respond to customer tickets", "Document recurring customer issues", "Maintain help-center answers"], ["Customer issue resolution", "Support ticket management", "Knowledge base maintenance"], ["Customer service", "Service communication"], ["Help desk software"], ["Resolved customer case"]),
  role("sales-operations", "Sales Operations Assistant", "Sales Operations", ["Clean opportunity records", "Track pipeline movement", "Prepare sales forecasts"], ["Sales pipeline administration", "Revenue reporting", "CRM data quality"], ["Sales operations", "Revenue process"], ["CRM platform", "Spreadsheet"], ["Pipeline forecast"]),
  role("operations", "Operations Improvement Assistant", "Business Operations", ["Map internal workflows", "Measure process cycle times", "Document operating procedures"], ["Process mapping", "Operational analysis", "Procedure documentation"], ["Business operations", "Process improvement"], ["Process mapping software"], ["Process map", "Procedure guide"]),
];

function need(overrides: Partial<WorkNeedProfile>): WorkNeedProfile {
  return WorkNeedProfileSchema.parse({
    originalRequest: "The company needs support with a work problem.",
    explicitRoleTitle: null,
    problems: [],
    activities: [],
    domainSignals: [],
    systemsOrTools: [],
    desiredOutcomes: [],
    constraints: [],
    activityClarity: "clear",
    domainClarity: "clear",
    seniorityIntent: "intern/junior",
    ...overrides,
  });
}

type HeldOutCase = {
  label: string;
  expectedFamily?: string;
  shouldClarify?: boolean;
  explicitTitle?: string;
  workNeed: WorkNeedProfile;
};

const CLEAR_CASES: HeldOutCase[] = [
  { label: "software/browser workflow", expectedFamily: "Software Development", workNeed: need({ activities: ["implement browser user interfaces", "integrate REST API services"], domainSignals: ["software engineering", "web applications"], systemsOrTools: ["JavaScript", "REST API"] }) },
  { label: "software/application testing", expectedFamily: "Software Development", workNeed: need({ activities: ["build an application feature", "test application behavior"], domainSignals: ["application software development"], desiredOutcomes: ["reliable application behavior"] }) },
  { label: "IT/device incidents", expectedFamily: "Information Technology Support", workNeed: need({ activities: ["diagnose employee workstation failures", "resolve connectivity incidents"], domainSignals: ["end-user information technology support"], systemsOrTools: ["Windows"] }) },
  { label: "IT/device setup", expectedFamily: "Information Technology Support", workNeed: need({ activities: ["configure new staff devices", "troubleshoot operating system problems"], domainSignals: ["computer support operations"], desiredOutcomes: ["working employee devices"] }) },
  { label: "finance/close", expectedFamily: "Accounting and Finance", workNeed: need({ activities: ["reconcile invoice payments", "prepare month-end financial statements"], domainSignals: ["accounting and financial control"], systemsOrTools: ["accounting software"] }) },
  { label: "finance/ledger", expectedFamily: "Accounting and Finance", workNeed: need({ activities: ["verify ledger entries", "investigate supplier payment discrepancies"], domainSignals: ["bookkeeping and accounting"], desiredOutcomes: ["accurate financial records"] }) },
  { label: "reporting/dashboards", expectedFamily: "Data and Business Intelligence", workNeed: need({ activities: ["clean reporting data", "develop recurring dashboards"], domainSignals: ["business intelligence and reporting"], systemsOrTools: ["dashboard software"] }) },
  { label: "reporting/validation", expectedFamily: "Data and Business Intelligence", workNeed: need({ activities: ["validate report totals", "prepare management reporting"], domainSignals: ["data quality and business reporting"], desiredOutcomes: ["trusted management dashboards"] }) },
  { label: "systems/migration", expectedFamily: "Enterprise Systems Implementation", workNeed: need({ activities: ["map legacy data fields", "validate migrated business records"], domainSignals: ["enterprise business system implementation"], systemsOrTools: ["ERP platform"] }) },
  { label: "systems/testing", expectedFamily: "Enterprise Systems Implementation", workNeed: need({ activities: ["prepare records for system migration", "track implementation defects"], domainSignals: ["enterprise software transition"], desiredOutcomes: ["reliable system migration"] }) },
  { label: "pharmacy/inventory", expectedFamily: "Pharmacy and Healthcare Operations", workNeed: need({ activities: ["reconcile medicine inventory records", "audit medication expiry records"], domainSignals: ["pharmacy healthcare operations"], systemsOrTools: ["pharmacy inventory system"] }) },
  { label: "pharmacy/compliance", expectedFamily: "Pharmacy and Healthcare Operations", workNeed: need({ activities: ["document dispensing workflow exceptions", "check medicine storage records"], domainSignals: ["medication safety and pharmacy operations"], desiredOutcomes: ["compliant pharmacy records"] }) },
  { label: "logistics/shipments", expectedFamily: "Logistics and Supply Chain", workNeed: need({ activities: ["track arriving shipments", "coordinate delivery schedules"], domainSignals: ["logistics and transportation"], systemsOrTools: ["transportation management system"] }) },
  { label: "logistics/documents", expectedFamily: "Logistics and Supply Chain", workNeed: need({ activities: ["prepare freight documents", "report shipment status"], domainSignals: ["supply chain logistics"], desiredOutcomes: ["on-time deliveries"] }) },
  { label: "manufacturing/inspection", expectedFamily: "Manufacturing and Quality", workNeed: need({ activities: ["inspect product defects", "record production quality results"], domainSignals: ["manufacturing quality assurance"], systemsOrTools: ["quality management system"] }) },
  { label: "manufacturing/defects", expectedFamily: "Manufacturing and Quality", workNeed: need({ activities: ["analyze recurring defect patterns", "monitor production line quality"], domainSignals: ["production manufacturing processes"], desiredOutcomes: ["fewer manufacturing defects"] }) },
  { label: "architecture/drawings", expectedFamily: "Architecture and Built Environment", workNeed: need({ activities: ["prepare building CAD drawings", "revise architectural plans"], domainSignals: ["architecture and building design"], systemsOrTools: ["CAD software"] }) },
  { label: "architecture/site records", expectedFamily: "Architecture and Built Environment", workNeed: need({ activities: ["update plans from site measurements", "create design presentation boards"], domainSignals: ["built environment design"], desiredOutcomes: ["accurate construction drawings"] }) },
  { label: "marketing/content", expectedFamily: "Marketing and Communications", workNeed: need({ activities: ["draft campaign content", "coordinate content publishing schedules"], domainSignals: ["marketing communications"], systemsOrTools: ["content calendar"] }) },
  { label: "marketing/performance", expectedFamily: "Marketing and Communications", workNeed: need({ activities: ["review campaign engagement", "prepare a marketing campaign report"], domainSignals: ["audience marketing"], desiredOutcomes: ["improved campaign performance"] }) },
  { label: "HR/onboarding", expectedFamily: "Human Resources", workNeed: need({ activities: ["maintain employee onboarding records", "prepare new-starter documentation"], domainSignals: ["human resources and employment processes"], systemsOrTools: ["HR information system"] }) },
  { label: "HR/interviews", expectedFamily: "Human Resources", workNeed: need({ activities: ["coordinate candidate interview schedules", "administer recruitment records"], domainSignals: ["human resources recruitment"], systemsOrTools: ["applicant tracking system"] }) },
  { label: "customer support/tickets", expectedFamily: "Customer Service", workNeed: need({ activities: ["respond to customer support tickets", "resolve customer issues"], domainSignals: ["customer service operations"], systemsOrTools: ["help desk software"] }) },
  { label: "customer support/knowledge", expectedFamily: "Customer Service", workNeed: need({ activities: ["document recurring customer problems", "maintain help-center answers"], domainSignals: ["customer support communication"], desiredOutcomes: ["faster issue resolution"] }) },
  { label: "sales ops/pipeline", expectedFamily: "Sales Operations", workNeed: need({ activities: ["clean sales opportunity records", "track pipeline movement"], domainSignals: ["sales operations and revenue process"], systemsOrTools: ["CRM platform"] }) },
  { label: "sales ops/forecast", expectedFamily: "Sales Operations", workNeed: need({ activities: ["prepare revenue forecasts", "report sales pipeline changes"], domainSignals: ["sales operations"], desiredOutcomes: ["reliable sales forecast"] }) },
  { label: "operations/process", expectedFamily: "Business Operations", workNeed: need({ activities: ["map internal workflows", "measure process cycle time"], domainSignals: ["business operations improvement"], systemsOrTools: ["process mapping software"] }) },
  { label: "operations/procedures", expectedFamily: "Business Operations", workNeed: need({ activities: ["document operating procedures", "analyze operational bottlenecks"], domainSignals: ["operational process improvement"], desiredOutcomes: ["faster internal workflow"] }) },
];

const AMBIGUOUS_CASES: HeldOutCase[] = [
  "We need help improving an internal system.",
  "Our records are disorganized and people are frustrated.",
  "We need somebody to support operations.",
  "A team needs better reporting and follow-up.",
  "Our customer platform is difficult to manage.",
  "We want an intern to review documentation.",
].map((originalRequest, index) => ({
  label: `ambiguous/${index + 1}`,
  shouldClarify: true,
  workNeed: need({
    originalRequest,
    problems: [originalRequest],
    activities: [],
    domainSignals: [],
    activityClarity: "ambiguous",
    domainClarity: "ambiguous",
  }),
}));

const EXPLICIT_CASES: HeldOutCase[] = [
  {
    label: "explicit/named specialist",
    explicitTitle: "Digital Accessibility Intern",
    workNeed: need({ explicitRoleTitle: "Digital Accessibility Intern", activities: ["review interface accessibility"], domainSignals: ["digital accessibility"] }),
  },
  {
    label: "explicit/named coordinator",
    explicitTitle: "Community Partnerships Intern",
    workNeed: need({ explicitRoleTitle: "Community Partnerships Intern", activities: ["coordinate partner outreach"], domainSignals: ["community partnerships"] }),
  },
];

describe("role intelligence held-out generalization", () => {
  it("meets aggregate domain, activity, clarification, and preservation gates", () => {
    let domainCorrect = 0;
    let taskRelevant = 0;
    let crossDomain = 0;
    let clarificationCorrect = 0;
    let explicitPreserved = 0;
    let recommendations = 0;
    let highConfidenceRecommendations = 0;
    let highConfidenceCorrect = 0;

    for (const testCase of CLEAR_CASES) {
      const result = recommendRoleFromProfiles(testCase.workNeed, HELD_OUT_PROFILES);
      const selected = HELD_OUT_PROFILES.find((profile) => profile.id === result.recommendedRole?.roleProfileId);
      if (result.recommendedRole) recommendations += 1;
      if (selected?.occupationFamily === testCase.expectedFamily) domainCorrect += 1;
      else if (result.recommendedRole) crossDomain += 1;
      if (result.recommendedRole?.evidence.length) taskRelevant += 1;
      if ((result.recommendedRole?.confidence ?? 0) >= 0.7) {
        highConfidenceRecommendations += 1;
        if (selected?.occupationFamily === testCase.expectedFamily) highConfidenceCorrect += 1;
      }
    }

    for (const testCase of AMBIGUOUS_CASES) {
      const result = recommendRoleFromProfiles(testCase.workNeed, HELD_OUT_PROFILES);
      if (
        result.clarificationNeeded &&
        !result.recommendedRole &&
        result.clarificationQuestion === "What kind of work should this person mainly own day to day?"
      ) clarificationCorrect += 1;
    }

    for (const testCase of EXPLICIT_CASES) {
      const result = recommendRoleFromProfiles(testCase.workNeed, HELD_OUT_PROFILES);
      if (result.recommendedRole?.title === testCase.explicitTitle && result.roleSource === "explicit") explicitPreserved += 1;
    }

    const metrics = {
      clearCases: CLEAR_CASES.length,
      domainCorrectRate: domainCorrect / CLEAR_CASES.length,
      taskEvidenceRate: taskRelevant / CLEAR_CASES.length,
      crossDomainRate: crossDomain / CLEAR_CASES.length,
      clearCaseRecommendationRate: recommendations / CLEAR_CASES.length,
      clearCaseAbstentionRate: (CLEAR_CASES.length - recommendations) / CLEAR_CASES.length,
      highConfidencePrecision: highConfidenceRecommendations
        ? highConfidenceCorrect / highConfidenceRecommendations
        : 1,
      highConfidenceRecommendations,
      ambiguousCases: AMBIGUOUS_CASES.length,
      clarificationAccuracy: clarificationCorrect / AMBIGUOUS_CASES.length,
      explicitCases: EXPLICIT_CASES.length,
      explicitTitlePreservation: explicitPreserved / EXPLICIT_CASES.length,
    };
    console.info("ROLE_INTELLIGENCE_HELD_OUT_METRICS", JSON.stringify(metrics));

    expect(metrics.domainCorrectRate).toBeGreaterThanOrEqual(0.9);
    expect(metrics.taskEvidenceRate).toBeGreaterThanOrEqual(0.85);
    expect(metrics.crossDomainRate).toBeLessThanOrEqual(0.05);
    expect(metrics.highConfidencePrecision).toBe(1);
    expect(metrics.clarificationAccuracy).toBe(1);
    expect(metrics.explicitTitlePreservation).toBe(1);
  });
});
