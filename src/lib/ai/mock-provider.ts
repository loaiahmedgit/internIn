import type { AIProvider } from "./provider";
import type {
  CandidateComparisonRow,
  CandidateEvidence,
  Challenge,
  InternshipDraft,
  InternshipProgram,
  ResumeExtraction,
  RubricCriterion,
  Scenario,
} from "./schemas";

/**
 * Realistic templated generation with no network call — used for Phase 1 so the
 * full product experience is demonstrable before a real model is wired up.
 * Implements the exact same AIProvider interface GemmaProvider will implement
 * in Phase 2, so swapping providers later is a one-line change in ./index.ts.
 */

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type RoleTemplate = {
  match: RegExp;
  role: string;
  skills: string[];
  companyName: string;
  premise: string;
  dataDescription: string;
  taskVerbs: string[];
  deliverables: string[];
};

const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    match: /data|sql|excel|analy|dashboard|power ?bi/i,
    role: "Data Analyst Intern",
    skills: ["SQL", "Excel", "Power BI", "Data Analysis"],
    companyName: "Northbridge Retail Group",
    premise:
      "Northbridge Retail Group's electronics category revenue declined 14% this quarter and leadership doesn't know why.",
    dataDescription:
      "a synthetic 5,000-row transactions table, a product catalog, and a one-page brief — no real customer data",
    taskVerbs: [
      "Clean and validate the raw transactions data",
      "Identify which sub-categories and regions are driving the decline",
      "Build a simple dashboard summarizing the trend",
      "Write three data-backed recommendations for leadership",
    ],
    deliverables: ["A cleaned dataset", "A one-page dashboard", "A short written recommendation"],
  },
  {
    match: /market|campaign|social|brand|content/i,
    role: "Marketing Intern",
    skills: ["Campaign Analysis", "Market Research", "Copywriting"],
    companyName: "Fable & Fern (fictional restaurant brand)",
    premise:
      "Fable & Fern is launching a new seasonal menu item and needs a first-pass go-to-market read before the real campaign is greenlit.",
    dataDescription:
      "synthetic campaign performance numbers, three fictional competitor profiles, and simulated customer feedback",
    taskVerbs: [
      "Review the competitor profiles and prior campaign performance",
      "Identify the strongest audience segment to target",
      "Draft key messaging for the launch",
      "Propose a simple two-week campaign plan",
    ],
    deliverables: ["A one-page campaign brief", "Draft messaging/copy", "A two-week plan outline"],
  },
  {
    match: /develop|code|engineer|software|bug|api|frontend|backend/i,
    role: "Software Engineering Intern",
    skills: ["JavaScript/TypeScript", "Debugging", "Git"],
    companyName: "Latch (fictional internal tools startup)",
    premise:
      "Latch's internal support tool has a reporting bug that's producing incorrect totals, and the team needs a fresh set of eyes.",
    dataDescription:
      "a small sandboxed codebase, a bug report, and a test suite — no access to production systems",
    taskVerbs: [
      "Reproduce the bug from the report",
      "Trace the root cause in the sandboxed codebase",
      "Write a fix with a passing test",
      "Document what caused it and how it was fixed",
    ],
    deliverables: ["A code fix", "A passing test", "A short root-cause writeup"],
  },
  {
    match: /financ|account|budget|revenue|statement/i,
    role: "Finance Intern",
    skills: ["Financial Analysis", "Excel", "Forecasting"],
    companyName: "Halcyon Freight (fictional logistics company)",
    premise:
      "Halcyon Freight's Q3 operating margin dropped and finance leadership wants a first read before the board meeting.",
    dataDescription:
      "synthetic quarterly financial statements and a cost breakdown by route — no real financial data",
    taskVerbs: [
      "Review the provided statements and cost breakdown",
      "Identify which cost centers moved the most",
      "Build a simple variance summary",
      "Recommend two areas worth investigating further",
    ],
    deliverables: ["A variance summary", "A short memo with recommendations"],
  },
  {
    match: /design|ux|ui|figma|brief/i,
    role: "Design Intern",
    skills: ["UI Design", "Design Systems", "Prototyping"],
    companyName: "Loomwork (fictional productivity app)",
    premise:
      "Loomwork wants a fresh onboarding flow concept for a feature that's currently confusing new users.",
    dataDescription:
      "a design brief, existing screens, and simulated user feedback — no real user data",
    taskVerbs: [
      "Review the current onboarding flow and feedback",
      "Identify the main points of confusion",
      "Design an improved flow (wireframe-level is fine)",
      "Explain the reasoning behind the key changes",
    ],
    deliverables: ["Wireframes or mockups", "A short rationale writeup"],
  },
];

const DEFAULT_TEMPLATE: RoleTemplate = {
  match: /.*/,
  role: "Business Analyst Intern",
  skills: ["Business Reasoning", "Communication", "Research"],
  companyName: "Meridian Insurance Group (fictional)",
  premise:
    "Meridian Insurance Group's customer complaints rose 18% this quarter and leadership wants a first analysis before the board meeting.",
  dataDescription: "a synthetic complaints dataset and a one-page brief — no real customer data",
  taskVerbs: [
    "Review the provided brief and data",
    "Identify the most likely causes of the trend",
    "Propose two concrete solutions",
    "Summarize findings for a non-technical audience",
  ],
  deliverables: ["A short written analysis", "Two concrete recommendations"],
};

function pickTemplate(text: string): RoleTemplate {
  return ROLE_TEMPLATES.find((t) => t.match.test(text)) ?? DEFAULT_TEMPLATE;
}

function extractHours(text: string): number {
  const match = text.match(/(\d{1,2})\s*(hours?|hrs?)/i);
  return match ? Number(match[1]) : 20;
}

function extractWeeks(text: string): string {
  const match = text.match(/(\d{1,2})\s*week/i);
  return match ? `${match[1]} weeks` : "8 weeks";
}

export class MockAIProvider implements AIProvider {
  async organizeEvidence(): Promise<never> {
    throw new Error("Evidence evaluation is unavailable until the AI provider is configured. Submitted files remain available for human review.");
  }
  async generateInternship(input: { description: string }): Promise<InternshipDraft> {
    await wait(900);
    const t = pickTemplate(input.description);
    return {
      role: t.role,
      duration: extractWeeks(input.description),
      hoursPerWeek: extractHours(input.description),
      location: "Doha / Hybrid",
      slots: 1,
      skills: t.skills,
      description: input.description.trim(),
    };
  }

  async generateSyntheticScenario(input: { workDescription: string }): Promise<Scenario> {
    await wait(500);
    const t = pickTemplate(input.workDescription);
    return {
      companyName: t.companyName,
      premise: t.premise,
      dataDescription: t.dataDescription,
    };
  }

  async generateRubric(challenge: Challenge): Promise<RubricCriterion[]> {
    await wait(400);
    return [
      { criterion: "Technical accuracy", description: `Correct use of ${challenge.skills.join(", ")}.` },
      { criterion: "Business reasoning", description: "Conclusions are grounded in the provided data, not guesswork." },
      { criterion: "Clarity", description: "Findings are explained so a non-technical reader could follow them." },
      { criterion: "Completeness", description: "All requested deliverables are present." },
    ];
  }

  async generateChallenge(input: {
    internship: InternshipDraft;
    workDescription: string;
  }): Promise<Challenge> {
    await wait(1400);
    const t = pickTemplate(input.workDescription || input.internship.role);
    const scenario = await this.generateSyntheticScenario({ workDescription: input.workDescription });

    const draft: Challenge = {
      title: `${t.role.replace(" Intern", "")} Challenge`,
      scenario: `You've joined ${scenario.companyName} as an intern. ${scenario.premise}`,
      estimatedMinutes: 75,
      skills: t.skills,
      tasks: t.taskVerbs.map((v, i) => ({
        id: crypto.randomUUID(),
        title: `Task ${i + 1}`,
        description: v,
      })),
      deliverables: t.deliverables,
      files: [
        { name: "brief.pdf", description: "One-page scenario brief" },
        { name: "dataset.csv", description: `Synthetic dataset: ${scenario.dataDescription}` },
      ],
      rubric: [],
      status: "ai_generated",
    };
    draft.rubric = await this.generateRubric(draft);
    return draft;
  }

  async editChallenge(challenge: Challenge, instruction: string): Promise<Challenge> {
    await wait(800);
    const next: Challenge = structuredClone(challenge);
    const lower = instruction.toLowerCase();

    if (/easier|simpler|beginner/.test(lower)) {
      next.estimatedMinutes = Math.max(30, next.estimatedMinutes - 20);
      next.tasks = next.tasks.slice(0, Math.max(2, next.tasks.length - 1));
    }
    if (/harder|advanced|challenging/.test(lower)) {
      next.estimatedMinutes += 20;
      next.tasks.push({
        id: crypto.randomUUID(),
        title: `Task ${next.tasks.length + 1}`,
        description: "Justify your recommendation with a quantified business impact estimate.",
      });
    }
    const minutesMatch = lower.match(/(\d{2,3})\s*minutes?/);
    if (minutesMatch) {
      next.estimatedMinutes = Number(minutesMatch[1]);
    }
    if (/excel/.test(lower) && !next.skills.some((s) => /excel/i.test(s))) {
      next.skills = [...next.skills.filter((s) => !/python|sql/i.test(s)), "Excel"];
    }
    const removeMatch = lower.match(/remove (?:task\s*)?(\d+)/);
    if (removeMatch) {
      const idx = Number(removeMatch[1]) - 1;
      next.tasks = next.tasks.filter((_, i) => i !== idx);
    }
    const rowsMatch = lower.match(/(\d[\d,]*)\s*rows?/);
    if (rowsMatch) {
      const csvFile = next.files.find((f) => f.name.endsWith(".csv"));
      if (csvFile) csvFile.description = `Synthetic dataset with ${rowsMatch[1]} rows`;
    }

    next.status = "pending_approval";
    return next;
  }

  async summarizeCandidate(input: {
    candidateName: string;
    challenge: Challenge;
    submissionNotes: string;
  }): Promise<CandidateEvidence> {
    await wait(700);
    const notes = input.submissionNotes.trim();
    return {
      candidateName: input.candidateName,
      tasksCompleted: `${Math.max(1, input.challenge.tasks.length - 1)}/${input.challenge.tasks.length}`,
      timeSpentMinutes: Math.round(input.challenge.estimatedMinutes * 0.9),
      submissionSummary: `${input.challenge.deliverables[0] ?? "Submission"} + written notes`,
      aiSummary: notes
        ? `${input.candidateName} covered the core ${input.challenge.skills[0] ?? "task"} work and wrote: "${notes.slice(0, 160)}${notes.length > 160 ? "…" : ""}" Recommendations were reasonable but could go deeper on quantified impact.`
        : `${input.candidateName} covered the core ${input.challenge.skills[0] ?? "task"} work clearly and stayed close to the estimated time. No written notes were included with the submission.`,
      strength: `Strong ${input.challenge.skills[0] ?? "technical"} execution`,
      weakness: notes ? "Recommendations lack quantified business impact" : "No written rationale accompanied the submission",
    };
  }

  async compareCandidates(candidates: CandidateEvidence[]): Promise<CandidateComparisonRow[]> {
    await wait(900);
    return candidates.map((c) => ({
      candidateName: c.candidateName,
      completion: c.tasksCompleted,
      timeMinutes: c.timeSpentMinutes,
      analysis: c.strength,
      communication: "Clear",
      mainStrength: c.strength,
      mainWeakness: c.weakness,
    }));
  }

  async generateInternshipProgram(input: {
    internName: string;
    role: string;
    durationWeeks: number;
    hoursPerWeek: number;
    goals: string;
  }): Promise<InternshipProgram> {
    await wait(1200);
    const weekTitles = [
      "Onboarding",
      "Foundational research",
      "Applied analysis",
      "First real contribution",
      "Deepen scope",
      "Execution support",
      "Optimization",
      "Final project",
    ];
    const weeks = Array.from({ length: input.durationWeeks }, (_, i) => ({
      week: i + 1,
      title: weekTitles[i] ?? `Week ${i + 1}`,
      objectives:
        i === 0
          ? ["Meet the team", "Learn the product/business context", "Set up tools and access"]
          : i === input.durationWeeks - 1
            ? ["Finalize and present the capstone project", "Document work completed"]
            : [`Work toward: ${input.goals}`],
    }));
    return {
      internName: input.internName,
      role: input.role,
      durationWeeks: input.durationWeeks,
      hoursPerWeek: input.hoursPerWeek,
      weeks,
    };
  }

  async extractResumeInfo(resumeText: string): Promise<ResumeExtraction> {
    await wait(800);
    const lower = resumeText.toLowerCase();
    const skillKeywords = [
      "excel", "sql", "python", "javascript", "figma", "photoshop", "marketing",
      "sales", "leadership", "communication", "research", "writing", "data analysis",
    ];
    const interestKeywords = [
      "software engineering", "data & analytics", "marketing", "finance", "design",
      "business & operations", "sales", "human resources", "research",
    ];
    const skills = skillKeywords.filter((k) => lower.includes(k)).map((k) => k.replace(/\b\w/g, (c) => c.toUpperCase()));
    const interests = interestKeywords.filter((k) => lower.includes(k.split(" ")[0]));
    return {
      skills: skills.length > 0 ? skills : ["Communication", "Teamwork"],
      interests: interests.length > 0 ? interests : ["Business & Operations"],
    };
  }
}
