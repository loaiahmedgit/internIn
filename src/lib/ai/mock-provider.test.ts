import { describe, it, expect } from "vitest";
import { MockAIProvider } from "./mock-provider";
import type { Challenge } from "./schemas";

const provider = new MockAIProvider();

function makeChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    title: "Data Analyst Challenge",
    scenario: "You've joined a company as an intern.",
    estimatedMinutes: 75,
    skills: ["SQL", "Excel", "Power BI", "Data Analysis"],
    tasks: [
      { id: "t1", title: "Task 1", description: "Clean data" },
      { id: "t2", title: "Task 2", description: "Analyze trend" },
      { id: "t3", title: "Task 3", description: "Build dashboard" },
    ],
    deliverables: ["A cleaned dataset", "A dashboard"],
    files: [
      { name: "brief.pdf", description: "One-page brief" },
      { name: "dataset.csv", description: "Synthetic dataset" },
    ],
    rubric: [{ criterion: "Technical accuracy", weight: 100, description: "..." }],
    submissionRequirements: [{ id: "req1", label: "Written analysis", inputMode: "text", artifactKind: "text_response", required: true }],
    status: "ai_generated",
    ...overrides,
  };
}

describe("generateInternship — role detection", () => {
  it.each([
    ["clean sales data with SQL and Excel", "Data Analyst Intern"],
    ["help with our marketing campaign and social content", "Marketing Intern"],
    ["fix bugs in our backend api", "Software Engineering Intern"],
    ["review our quarterly financial statements and budget", "Finance Intern"],
    ["work on our ux design and figma prototypes", "Design Intern"],
    ["general office helper with no specific skill mentioned", "Business Analyst Intern"],
  ])("maps %j -> %s", async (description, expectedRole) => {
    const draft = await provider.generateInternship({ description });
    expect(draft.role).toBe(expectedRole);
  });

  it("extracts explicit hours per week", async () => {
    const draft = await provider.generateInternship({ description: "20 hours per week, SQL work" });
    expect(draft.hoursPerWeek).toBe(20);
  });

  it("defaults hours to 20 when not specified", async () => {
    const draft = await provider.generateInternship({ description: "SQL work, no hours mentioned" });
    expect(draft.hoursPerWeek).toBe(20);
  });

  it("extracts explicit week count", async () => {
    const draft = await provider.generateInternship({ description: "a 12 week data internship" });
    expect(draft.duration).toBe("12 weeks");
  });

  it("defaults duration to 8 weeks when not specified", async () => {
    const draft = await provider.generateInternship({ description: "SQL work" });
    expect(draft.duration).toBe("8 weeks");
  });

  it("preserves the trimmed description verbatim", async () => {
    const draft = await provider.generateInternship({ description: "  SQL work  " });
    expect(draft.description).toBe("SQL work");
  });
});

describe("generateChallenge", () => {
  it("produces an ai_generated challenge with a populated rubric and files", async () => {
    const internship = await provider.generateInternship({ description: "SQL and Excel work" });
    const challenge = await provider.generateChallenge({
      internship,
      workDescription: "clean sales data and find why a category is declining",
    });

    expect(challenge.status).toBe("ai_generated");
    expect(challenge.title).toBe("Data Analyst Challenge");
    expect(challenge.tasks.length).toBeGreaterThan(0);
    expect(challenge.tasks.every((t) => t.id.length > 0)).toBe(true);
    expect(challenge.rubric).toHaveLength(4);
    expect(challenge.files.map((f) => f.name)).toEqual(["brief.pdf", "dataset.csv"]);
  });

  it("falls back to the internship role when workDescription is empty", async () => {
    const internship = await provider.generateInternship({ description: "marketing campaign work" });
    const challenge = await provider.generateChallenge({ internship, workDescription: "" });
    expect(challenge.title).toBe("Marketing Challenge");
  });
});

describe("editChallenge", () => {
  it("always moves status to pending_approval", async () => {
    const next = await provider.editChallenge(makeChallenge(), "no-op instruction");
    expect(next.status).toBe("pending_approval");
  });

  it("'easier' reduces time and trims tasks, never below the floor", async () => {
    const next = await provider.editChallenge(makeChallenge({ estimatedMinutes: 40 }), "make it easier");
    expect(next.estimatedMinutes).toBe(30); // floor at 30, not 40-20=20
    expect(next.tasks.length).toBe(2); // 3 tasks -> max(2, 3-1) = 2
  });

  it("'easier' never drops below 2 tasks", async () => {
    const twoTaskChallenge = makeChallenge({
      tasks: [
        { id: "a", title: "Task 1", description: "x" },
        { id: "b", title: "Task 2", description: "y" },
      ],
    });
    const next = await provider.editChallenge(twoTaskChallenge, "simpler please");
    expect(next.tasks.length).toBe(2);
  });

  it("'harder' increases time and appends a task", async () => {
    const base = makeChallenge();
    const next = await provider.editChallenge(base, "make it harder");
    expect(next.estimatedMinutes).toBe(base.estimatedMinutes + 20);
    expect(next.tasks.length).toBe(base.tasks.length + 1);
    expect(next.tasks.at(-1)?.id).toBeTruthy();
  });

  it("explicit '90 minutes' overrides the estimate directly", async () => {
    const next = await provider.editChallenge(makeChallenge(), "give them 90 minutes");
    expect(next.estimatedMinutes).toBe(90);
  });

  it("'excel' adds Excel and removes Python/SQL from skills", async () => {
    const base = makeChallenge({ skills: ["SQL", "Data Analysis"] });
    const next = await provider.editChallenge(base, "replace with excel instead");
    expect(next.skills).toContain("Excel");
    expect(next.skills).not.toContain("SQL");
  });

  it("does not duplicate Excel if already present", async () => {
    const base = makeChallenge({ skills: ["Excel", "Data Analysis"] });
    const next = await provider.editChallenge(base, "use excel");
    expect(next.skills.filter((s) => s === "Excel")).toHaveLength(1);
  });

  it("'remove task 2' removes exactly that task by position", async () => {
    const base = makeChallenge();
    const next = await provider.editChallenge(base, "remove task 2");
    expect(next.tasks).toHaveLength(2);
    expect(next.tasks.map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("'5,000 rows' updates the csv file description", async () => {
    const next = await provider.editChallenge(makeChallenge(), "create synthetic data with 5,000 rows");
    const csv = next.files.find((f) => f.name === "dataset.csv");
    expect(csv?.description).toContain("5,000 rows");
  });

  it("does not mutate the original challenge object", async () => {
    const base = makeChallenge();
    const originalMinutes = base.estimatedMinutes;
    await provider.editChallenge(base, "give them 90 minutes");
    expect(base.estimatedMinutes).toBe(originalMinutes);
  });
});

describe("generateRubric", () => {
  it("returns exactly 4 criteria referencing the challenge's skills", async () => {
    const rubric = await provider.generateRubric(makeChallenge({ skills: ["SQL", "Excel"] }));
    expect(rubric).toHaveLength(4);
    expect(rubric[0].description).toContain("SQL");
    expect(rubric[0].description).toContain("Excel");
  });
});

describe("summarizeCandidate", () => {
  it("computes time as 90% of the estimate, rounded", async () => {
    const evidence = await provider.summarizeCandidate({
      candidateName: "Ahmed",
      challenge: makeChallenge({ estimatedMinutes: 75 }),
      submissionNotes: "",
    });
    expect(evidence.timeSpentMinutes).toBe(68); // round(75 * 0.9)
    expect(evidence.candidateName).toBe("Ahmed");
  });

  it("grounds the summary in submission notes when provided", async () => {
    const evidence = await provider.summarizeCandidate({
      candidateName: "Sara",
      challenge: makeChallenge(),
      submissionNotes: "I flagged a regional sales anomaly in Q3.",
    });
    expect(evidence.aiSummary).toContain("regional sales anomaly in Q3");
  });
});

describe("compareCandidates", () => {
  it("preserves order and count across candidates", async () => {
    const a = await provider.summarizeCandidate({ candidateName: "Ahmed", challenge: makeChallenge(), submissionNotes: "" });
    const b = await provider.summarizeCandidate({ candidateName: "Sara", challenge: makeChallenge(), submissionNotes: "" });
    const rows = await provider.compareCandidates([a, b]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.candidateName)).toEqual(["Ahmed", "Sara"]);
  });
});

describe("generateInternshipProgram", () => {
  it("generates exactly durationWeeks weeks with onboarding first and capstone last", async () => {
    const program = await provider.generateInternshipProgram({
      internName: "Ahmed",
      role: "Data Analyst Intern",
      durationWeeks: 4,
      hoursPerWeek: 20,
      goals: "learn the product",
    });
    expect(program.weeks).toHaveLength(4);
    expect(program.weeks[0].objectives).toContain("Meet the team");
    expect(program.weeks.at(-1)?.objectives.join(" ")).toContain("capstone project");
    expect(program.weeks[1].objectives[0]).toContain("learn the product");
  });
});

describe("extractResumeInfo", () => {
  it("detects known skill/interest keywords in resume text", async () => {
    const result = await provider.extractResumeInfo(
      "Experienced with Python, SQL, and Excel. Led marketing campaigns and enjoy data analysis.",
    );
    expect(result.skills).toEqual(expect.arrayContaining(["Python", "Sql", "Excel"]));
    expect(result.interests.length).toBeGreaterThan(0);
  });

  it("falls back to defaults when nothing matches", async () => {
    const result = await provider.extractResumeInfo("A completely unrelated block of text with no keywords at all.");
    expect(result.skills).toEqual(["Communication", "Teamwork"]);
    expect(result.interests).toEqual(["Business & Operations"]);
  });
});
