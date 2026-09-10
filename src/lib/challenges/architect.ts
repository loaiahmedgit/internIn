import { z } from "zod";

export const ASSESSMENT_PATTERNS = ["identify", "diagnose", "prioritize", "decide", "execute", "justify", "constraints", "trade_offs", "validate", "spot_risks", "escalate", "adapt", "communicate", "review", "improve"] as const;

const fact = z.string().trim().min(1).max(700).nullable();
/** Internal information model. Null means unknown. These are never rendered
 * as a mandatory fifteen-question employer survey. */
export const RoleRealitySchema = z.object({
  actualWork: fact,
  realisticExample: fact,
  expectedOutput: fact,
  qualityCriteria: fact,
  concerningMistakes: fact,
  expectedBeforeJoining: fact,
  willTeach: fact,
  resourcesAndTools: fact,
  constraints: fact,
  authorityAndEscalation: fact,
  changingConditions: fact,
  tradeOffs: fact,
  physicalSafetyAndConfidentiality: fact,
  teamAiUse: fact,
  evidenceToTrust: fact,
});
export type RoleReality = z.infer<typeof RoleRealitySchema>;

export function emptyRoleReality(): RoleReality {
  return RoleRealitySchema.parse(Object.fromEntries(Object.keys(RoleRealitySchema.shape).map((key) => [key, null])));
}

export const AssessmentPlanSchema = z.object({
  expectedBeforeJoining: z.array(z.string().trim().min(1).max(200)).min(1).max(8),
  willTeach: z.array(z.string().trim().min(1).max(200)).max(8),
  foundations: z.array(z.object({
    foundation: z.string().trim().min(1).max(160),
    pattern: z.enum(ASSESSMENT_PATTERNS),
    importance: z.enum(["required", "useful"]),
    candidateAction: z.string().trim().min(1).max(500),
    taskTitles: z.array(z.string().trim().min(1).max(160)).min(1).max(6),
    evidence: z.string().trim().min(1).max(500),
    humanReview: z.string().trim().min(1).max(500),
    // A proposed check is never reported as a passed validator. R6 supplies
    // real check results independently of this assessment design metadata.
    proposedDeterministicCheck: z.string().trim().min(1).max(300).nullable(),
  })).min(1).max(6),
  cannotEstablish: z.array(z.string().trim().min(1).max(250)).min(1).max(12),
  practicalVerificationRequired: z.array(z.string().trim().min(1).max(200)).max(8),
  activeMinutes: z.number().int().min(5).max(120),
  completionWindowHours: z.number().int().min(1).max(336).nullable(),
});
export type AssessmentPlan = z.infer<typeof AssessmentPlanSchema>;

// Drafts must remain saveable while a human is filling them in. Approval
// always uses the strict AssessmentPlanSchema above.
export const AssessmentPlanDraftSchema = AssessmentPlanSchema.extend({
  expectedBeforeJoining: z.array(z.string().trim().max(200)).max(8),
  foundations: z.array(AssessmentPlanSchema.shape.foundations.element.extend({
    foundation: z.string().trim().max(160), candidateAction: z.string().trim().max(500),
    taskTitles: z.array(z.string().trim().max(160)).max(6),
    evidence: z.string().trim().max(500), humanReview: z.string().trim().max(500),
  })).max(6),
  cannotEstablish: z.array(z.string().trim().max(250)).max(12),
  activeMinutes: z.number().int().min(5).max(480),
});

export function emptyAssessmentPlan(activeMinutes: number): AssessmentPlan {
  return { expectedBeforeJoining: [], willTeach: [], foundations: [], cannotEstablish: ["Overall job suitability, future performance, motivation, reliability and teamwork over time."], practicalVerificationRequired: [], activeMinutes, completionWindowHours: null };
}

const QUESTION_PRIORITY: { field: keyof RoleReality; question: string }[] = [
  { field: "actualWork", question: "What does this intern actually do on your team?" },
  { field: "expectedBeforeJoining", question: "What should this student already be able to do before joining?" },
  { field: "willTeach", question: "What will your team teach them during the internship?" },
  { field: "realisticExample", question: "Describe one small, realistic piece of work a new intern would handle." },
  { field: "qualityCriteria", question: "What would a good result look like, and what mistake would concern you?" },
];

/** Ask only missing high-value information; detailed answers may settle
 * several fields at once. Unknown low-value context stays unknown. */
export function nextArchitectQuestions(reality: RoleReality, limit = 3) {
  return QUESTION_PRIORITY.filter(({ field }) => !reality[field]).slice(0, Math.max(0, Math.min(limit, 4)));
}

/** Conservative authoring reminder from stated work, never candidate
 * eligibility or an inference about someone's profession/competence. */
export function involvesDirectCare(reality: RoleReality) {
  return /\b(caregiving|nursing|bedside|patient care|resident care|clinical care|medication administration)\b/i.test([reality.actualWork, reality.physicalSafetyAndConfidentiality].filter(Boolean).join(" "));
}

export function assertAssessmentPlan(plan: AssessmentPlan, tasks: { title: string }[], estimatedMinutes: number) {
  AssessmentPlanSchema.parse(plan);
  const taskTitles = new Set(tasks.map((task) => task.title));
  if (plan.foundations.some((foundation) => foundation.taskTitles.some((title) => !taskTitles.has(title)))) {
    throw new Error("Every assessed foundation must point to a task in this Challenge.");
  }
  if (plan.activeMinutes !== estimatedMinutes) throw new Error("Assessment plan and Challenge active-work time must agree.");
  const taught = new Set(plan.willTeach.map((value) => value.toLowerCase().trim()));
  if (plan.expectedBeforeJoining.some((value) => taught.has(value.toLowerCase().trim()))) {
    throw new Error("Separate entry requirements from foundations the team will teach.");
  }
  const expected = new Set(plan.expectedBeforeJoining.map((value) => value.toLowerCase().trim()));
  if (plan.foundations.some((item) => !expected.has(item.foundation.toLowerCase().trim()))) {
    throw new Error("Each assessed foundation must come from the stated before-joining expectations.");
  }
}

/** Publication needs employer-supplied context. AI may propose an
 * assessment, but it cannot attest to what a team will teach. */
export function assertArchitectReady(challenge: {
  roleReality?: RoleReality | null; assessmentPlan?: AssessmentPlan | null;
  tasks: { title: string }[]; estimatedMinutes: number;
}) {
  const reality = challenge.roleReality;
  if (!reality?.actualWork || !reality.expectedBeforeJoining || !reality.willTeach) {
    throw new Error("Describe the actual work, what students should know before joining, and what your team will teach.");
  }
  if (!challenge.assessmentPlan) throw new Error("Add an assessment plan linking entry foundations to tasks and evidence before approval.");
  assertAssessmentPlan(challenge.assessmentPlan, challenge.tasks, challenge.estimatedMinutes);
  if (involvesDirectCare(reality)) {
    const plan = challenge.assessmentPlan;
    if (!plan.practicalVerificationRequired.some((item) => /physical|practical|supervis/i.test(item)) || !plan.cannotEstablish.some((item) => /physical|clinical competence/i.test(item))) {
      throw new Error("For direct care, explicitly mark physical caregiving as not digitally assessed and requiring supervised practical verification.");
    }
  }
}

export const ARCHITECT_POLICY = `Design the smallest realistic assessment that exposes entry-level foundations.
Separate what the employer expects BEFORE JOINING from what their team WILL TEACH. Never invent employer prerequisites or punish candidates for skills they will be taught.
Use only the smallest relevant subset of Identify, Diagnose, Prioritize, Decide, Execute, Justify, Constraints, Trade-offs, Validate, Spot risks, Escalate, Adapt, Communicate, Review, Improve. Unselected patterns are NOT ASSESSED.
For each foundation state the actual candidate action, exact task title(s), resulting evidence, proposed factual check if one is feasible, and what a human must review. Proposed checks are not executed validation results.
State what this can provide evidence for and cannot establish. Never claim overall suitability, future performance, culture fit, motivation, long-term reliability, teamwork over time, or universal skill verification.
Use short written work/scenarios when they are the strongest evidence. Do not force every role into a project. Portfolios remain legitimate historical evidence; a fresh exercise does not automatically outrank them.
Active work: 5–15 minutes for short scenarios, 30–60 for standard work, 60–90 only when needed. Over 90 needs human justification; over 120 cannot publish. A completion window is elapsed availability, not active work. Keep activeMinutes consistent with the Challenge estimate.
For healthcare/caregiving, only fully fictional cases and supplied approved procedures. No patient data, identifiers, prescriptions, credentials, private records, diagnosis/prescribing tasks, or unsafe practical experimentation. Assess written recognition, prioritization, documentation, communication, scope and escalation only. Physical caregiving execution must be listed under practicalVerificationRequired and cannotEstablish, never implied by scenario performance.
For engineering/CAD and safety-critical work, do not invent physical or crashworthiness validation. For creative work, technical checks are distinct from human judgments of visual quality, taste and originality.`;
