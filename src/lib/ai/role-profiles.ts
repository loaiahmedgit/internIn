import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "./gemma-provider";
import { withGenerateRetries } from "./challenge-generation";

/**
 * The closed vocabulary of "what information is missing" — profession-
 * agnostic by construction. A question's TYPE (single/multiple/freeform)
 * is a property of the SLOT, never something the model decides per
 * question — this is the actual fix for "candidate level randomly became
 * a textbox for one profession": the model never gets to choose a type
 * for a fixed slot, code does.
 */
export const InformationSlotSchema = z.enum([
  "role_domain",
  "candidate_level",
  "responsibilities",
  "tools_technologies",
  "work_environment",
  "expected_deliverables",
  "access_level",
  "restrictions",
  "special_company_context",
]);
export type InformationSlot = z.infer<typeof InformationSlotSchema>;

/** Fixed, code-owned behavior per slot. `work_environment` is the one
 * slot the request explicitly says can go either way ("SINGLE or
 * MULTIPLE depending on whether several may apply") — it's the only slot
 * NOT in this map, so its type is resolved per-instance instead (see
 * resolveQuestionType). Every other slot's type is non-negotiable. */
export const SLOT_FIXED_TYPE: Partial<Record<InformationSlot, "single" | "multiple" | "freeform">> = {
  role_domain: "freeform",
  candidate_level: "single",
  responsibilities: "multiple",
  tools_technologies: "multiple",
  expected_deliverables: "multiple",
  access_level: "single",
  restrictions: "freeform",
  special_company_context: "freeform",
};

export function resolveQuestionType(slot: InformationSlot, modelSuggestedType: "single" | "multiple" | "freeform"): "single" | "multiple" | "freeform" {
  return SLOT_FIXED_TYPE[slot] ?? modelSuggestedType;
}

/**
 * Describes a PROFESSION, not a specific challenge — reusable across
 * every employer who hires for it, and safe to cache/persist. Populated
 * from a curated seed for common roles (instant, no model call) or
 * generated once per uncommon role and cached for the life of this
 * process. Designed so a future O*NET/ESCO- or database-backed lookup
 * could replace generateRoleProfile without touching any caller — no RAG,
 * no external call required for every request.
 */
export const RoleProfileSchema = z.object({
  normalizedRole: z.string().trim().min(2).max(120),
  occupationFamily: z.string().trim().min(2).max(120),
  taskFamilies: z.array(z.string().trim().min(1).max(100)).min(3).max(10),
  commonTools: z.array(z.string().trim().min(1).max(80)).max(10),
  workEnvironments: z.array(z.string().trim().min(1).max(80)).max(8),
  typicalDeliverables: z.array(z.string().trim().min(1).max(100)).max(8),
  competencies: z.array(z.string().trim().min(1).max(80)).max(8),
  safetyConstraints: z.array(z.string().trim().min(1).max(200)).max(6),
});
export type RoleProfile = z.infer<typeof RoleProfileSchema>;

/**
 * A small curated seed set for common internship roles — instant,
 * zero-latency, zero-cost lookups for the roles employers ask for most
 * often. Every choice here is deliberately ATOMIC (one tool/task per
 * entry, never "Python + FastAPI + React" or an acronym bundling several
 * technologies) — this is the source-level fix for bundled choices, not
 * just a downstream filter. Keyed by a lowercase, normalized match key;
 * see matchCuratedProfile for the lookup.
 */
const CURATED_ROLE_PROFILES: Record<string, RoleProfile> = {
  "full stack developer intern": {
    normalizedRole: "Full Stack Developer Intern",
    occupationFamily: "Software Engineering",
    taskFamilies: ["Building UI components", "Building API endpoints", "Database schema work", "Writing tests", "Bug fixing", "Code review"],
    commonTools: ["React", "Node.js", "TypeScript", "PostgreSQL", "Git", "REST APIs", "Docker"],
    workEnvironments: ["Fully remote", "Hybrid", "In-office"],
    typicalDeliverables: ["Working feature", "Pull request", "Test coverage", "Documentation"],
    competencies: ["Problem solving", "Code quality", "Communication", "Debugging"],
    safetyConstraints: [],
  },
  // "Web developer" is genuinely broader than "full stack" — frontend,
  // backend, full-stack, and testing/QA are different day-to-day work
  // AND different tech, which is exactly why this specific role needs a
  // real responsibilities question before a tools question can mean
  // anything (see assistant-router.ts's worked example for this exact
  // request). Kept as its own curated entry rather than folding into
  // "full stack developer" so its taskFamilies/commonTools stay broad
  // enough to build that first question well.
  "web developer intern": {
    normalizedRole: "Web Developer Intern",
    occupationFamily: "Software Engineering",
    taskFamilies: ["Frontend development", "Backend development", "Full-stack feature work", "Testing / QA", "Bug fixing"],
    commonTools: ["React", "Vue", "HTML/CSS", "JavaScript", "TypeScript", "Node.js", "Python", "REST APIs", "Git", "Jest/Cypress"],
    workEnvironments: ["Fully remote", "Hybrid", "In-office"],
    typicalDeliverables: ["Working feature", "Pull request", "Bug fix with notes", "Test coverage"],
    competencies: ["Problem solving", "Code quality", "Debugging", "Communication"],
    safetyConstraints: [],
  },
  "database intern": {
    normalizedRole: "Database Intern",
    occupationFamily: "Data & Database Engineering",
    taskFamilies: ["Writing SQL queries", "Data cleaning", "Database design/schema work", "Database administration", "Reporting/analytics", "Data migration"],
    commonTools: ["PostgreSQL", "MySQL", "SQL Server", "Oracle", "MongoDB"],
    workEnvironments: ["Fully remote", "Hybrid", "In-office"],
    typicalDeliverables: ["SQL scripts", "Findings summary", "Data quality report"],
    competencies: ["SQL correctness", "Data reasoning", "Documentation"],
    safetyConstraints: [],
  },
  "it technician intern": {
    normalizedRole: "IT Technician Intern",
    occupationFamily: "IT Support",
    taskFamilies: ["Hardware setup and repair", "Software troubleshooting", "Help desk / user support", "Network setup and troubleshooting", "Device deployment", "Accounts and access support"],
    commonTools: ["Windows", "macOS", "Microsoft 365", "Active Directory", "Ticketing system", "Networking tools"],
    workEnvironments: ["Corporate office", "School/university", "Retail/branch locations", "Remote workforce support"],
    typicalDeliverables: ["Resolved ticket log", "Setup checklist", "Troubleshooting notes"],
    competencies: ["Troubleshooting", "Customer service", "Documentation"],
    safetyConstraints: [],
  },
  "pharmacy intern": {
    normalizedRole: "Pharmacy Intern",
    occupationFamily: "Pharmacy",
    taskFamilies: ["Inventory and storage checks", "Documentation and records", "Sample preparation support", "Quality-control support", "Pharmacy operations", "Customer-facing support"],
    commonTools: ["Pharmacy management software", "Inventory system"],
    workEnvironments: ["Retail pharmacy", "Hospital pharmacy", "Clinical/lab setting"],
    typicalDeliverables: ["Inventory log", "Documentation entry", "Handoff note"],
    competencies: ["Attention to detail", "Documentation", "Following procedure"],
    safetyConstraints: [
      "Never have the candidate independently diagnose, prescribe, dispense, or make a real clinical decision — safe simulated tasks only.",
    ],
  },
  "marketing intern": {
    normalizedRole: "Marketing Intern",
    occupationFamily: "Marketing",
    taskFamilies: ["Social media content", "Campaign planning", "Copywriting", "Analytics and reporting", "Market research", "Email marketing"],
    commonTools: ["Canva", "Google Analytics", "Meta Ads Manager", "Mailchimp", "Hootsuite/Buffer"],
    workEnvironments: ["Fully remote", "Hybrid", "In-office"],
    typicalDeliverables: ["Content calendar", "Campaign brief", "Performance report"],
    competencies: ["Writing", "Creativity", "Data interpretation"],
    safetyConstraints: [],
  },
  "accountant intern": {
    normalizedRole: "Accounting Intern",
    occupationFamily: "Accounting & Finance",
    taskFamilies: ["Bookkeeping/data entry", "Reconciliation", "Invoice processing", "Financial reporting support", "Payroll support", "Audit support"],
    commonTools: ["Excel/Google Sheets", "QuickBooks", "Xero", "SAP"],
    workEnvironments: ["In-office", "Hybrid", "Fully remote"],
    typicalDeliverables: ["Reconciled ledger", "Spreadsheet report", "Summary memo"],
    competencies: ["Accuracy", "Attention to detail", "Spreadsheet skills"],
    safetyConstraints: [],
  },
  "mechanical engineering intern": {
    normalizedRole: "Mechanical Engineering Intern",
    occupationFamily: "Mechanical Engineering",
    taskFamilies: ["CAD design", "Prototyping/testing support", "Technical drawings", "Component analysis", "Documentation", "Manufacturing support"],
    commonTools: ["SolidWorks", "AutoCAD", "MATLAB", "Fusion 360"],
    workEnvironments: ["Workshop/lab", "Office/design studio", "Factory floor"],
    typicalDeliverables: ["CAD model", "Technical drawing", "Test report"],
    competencies: ["Technical drawing", "Problem solving", "Attention to detail"],
    safetyConstraints: ["Never have the candidate perform real unsupervised work on physical equipment — a safe simulated/desk task only."],
  },
  "graphic design intern": {
    normalizedRole: "Graphic Design Intern",
    occupationFamily: "Design",
    taskFamilies: ["Brand/identity design", "Social media graphics", "Layout/print design", "Illustration", "UI visual design", "Presentation design"],
    commonTools: ["Figma", "Adobe Photoshop", "Adobe Illustrator", "Canva"],
    workEnvironments: ["Fully remote", "Hybrid", "In-office/studio"],
    typicalDeliverables: ["Design mockup", "Style guide excerpt", "Final asset export"],
    competencies: ["Visual composition", "Typography", "Brand consistency"],
    safetyConstraints: [],
  },
  "architecture intern": {
    normalizedRole: "Architecture Intern",
    occupationFamily: "Architecture",
    taskFamilies: ["Drafting/CAD work", "3D modeling/rendering", "Site documentation", "Material research", "Presentation boards", "Code/zoning research"],
    commonTools: ["AutoCAD", "Revit", "SketchUp", "Adobe Creative Suite"],
    workEnvironments: ["Studio/office", "Site visits", "Hybrid"],
    typicalDeliverables: ["Drawing set", "3D render", "Presentation board"],
    competencies: ["Spatial reasoning", "Technical drawing", "Attention to detail"],
    safetyConstraints: [],
  },
  "hospitality intern": {
    normalizedRole: "Hospitality Intern",
    occupationFamily: "Hospitality & Tourism",
    taskFamilies: ["Front desk/guest services", "Event coordination", "Food & beverage support", "Housekeeping operations", "Reservations", "Customer service recovery"],
    commonTools: ["Property management system", "Reservation software", "POS system"],
    workEnvironments: ["Hotel/resort", "Restaurant/venue", "Event space"],
    typicalDeliverables: ["Guest interaction log", "Event checklist", "Service recovery note"],
    competencies: ["Customer service", "Communication", "Composure under pressure"],
    safetyConstraints: [],
  },
};

/** Loose, normalized matching so "IT guy intern"/"it technician" both hit
 * the same curated profile — checks whether the input contains (or is
 * contained by) a curated key's significant words. Deliberately simple:
 * this only needs to catch the common phrasing of roles we've curated,
 * not do general NLU (that's the LLM fallback's job). */
function matchCuratedProfile(normalizedRole: string): RoleProfile | null {
  const needle = normalizedRole.toLowerCase().replace(/\bintern(ship)?\b/g, "").trim();
  for (const [key, profile] of Object.entries(CURATED_ROLE_PROFILES)) {
    const keyCore = key.replace(/\bintern\b/g, "").trim();
    if (needle.includes(keyCore) || keyCore.includes(needle)) return profile;
  }
  return null;
}

// In-memory cache for LLM-generated (non-curated) role profiles — survives
// for the life of this server instance (warm serverless reuse), never
// hits the model twice for the same normalized role in that window. Not
// cross-instance/cross-deploy persistent; a real persistence layer
// (DB table) is a reasonable next step but out of scope for this pass —
// see the module doc comment.
const generatedProfileCache = new Map<string, RoleProfile>();

const ROLE_PROFILE_TIMEOUT_MS = 20_000;
const ROLE_PROFILE_ATTEMPTS = [{}, {}] as const;

async function generateRoleProfile(normalizedRole: string): Promise<RoleProfile> {
  return withGenerateRetries("generateRoleProfile", ROLE_PROFILE_ATTEMPTS, async () => {
    const { object } = await generateObject({
      model: getModel(),
      schema: RoleProfileSchema,
      system: `Describe the PROFESSION generically — not a specific job posting or challenge. Every entry in every array must be ATOMIC: one real task, tool, or environment per entry, never a bundle (bad: "Python + FastAPI + React", bad: an acronym standing in for several distinct technologies like "MERN" — write out the individual technologies as separate entries instead). Use plain, concrete language a hiring manager would recognize, not jargon.`,
      prompt: `Normalized role: ${normalizedRole}`,
      maxOutputTokens: 1200,
      abortSignal: AbortSignal.timeout(ROLE_PROFILE_TIMEOUT_MS),
    });
    return object;
  });
}

/**
 * The ONE entry point for getting a RoleProfile — curated (instant) ->
 * process cache (instant) -> generate + cache (one model call, only for
 * roles never seen before in this process). This is the fast path Part 9
 * asks for: a common role never touches the model at all for this step.
 */
export async function getRoleProfile(normalizedRole: string): Promise<RoleProfile> {
  const curated = matchCuratedProfile(normalizedRole);
  if (curated) return curated;

  const cacheKey = normalizedRole.toLowerCase().trim();
  const cached = generatedProfileCache.get(cacheKey);
  if (cached) return cached;

  const generated = await generateRoleProfile(normalizedRole);
  generatedProfileCache.set(cacheKey, generated);
  return generated;
}
