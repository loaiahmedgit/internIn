import { describe, expect, it } from "vitest";
import type { CandidateDetail } from "@/lib/company/candidate-detail-data";
import {
  candidateInsights,
  candidateSummaryUnavailableMessage,
} from "@/lib/company/candidate-insights";

function candidate(overrides: Partial<CandidateDetail> = {}): CandidateDetail {
  return {
    applicationId: "application-1",
    studentId: "student-1",
    studentName: "James Patel",
    studentEmail: "james@example.com",
    status: "applied",
    appliedAt: new Date("2026-08-30T10:00:00.000Z"),
    challengeStartedAt: new Date("2026-08-30T10:00:00.000Z"),
    opportunityId: "opportunity-1",
    role: "Data Analyst Intern",
    companyId: "company-1",
    profile: {
      educationStage: "University",
      university: "Carnegie Mellon University in Qatar",
      major: "Economics",
      graduationYear: 2027,
      location: "Al Rayyan, Qatar",
      skills: ["SQL", "Python", "Power BI", "Writing"],
      opportunityTypes: ["Internship"],
      availability: "15 hours/week",
      cvUrl: "https://example.com/cv.pdf",
    },
    submission: {
      id: "submission-1",
      submittedAt: new Date("2026-08-30T11:14:00.000Z"),
      notes: "Analysis notes",
      artifacts: [
        { name: "analysis.pdf", url: "https://example.com/analysis.pdf" },
        { name: "data.csv", url: "https://example.com/data.csv" },
      ],
      submissionArtifacts: [],
      aiUsageMode: "ai_allowed",
    },
    challenge: {
      title: "Warehouse delay investigation",
      scenario: "Investigate delays",
      skills: ["SQL", "Python", "Power BI"],
      tasks: [
        { id: "task-1", title: "Inspect", description: "Inspect the data" },
        { id: "task-2", title: "Analyze", description: "Find root causes" },
        { id: "task-3", title: "Recommend", description: "Propose next steps" },
      ],
      deliverables: ["Root cause analysis", "Recommendation memo", "Data extract"],
      rubric: [],
    },
    evidence: {
      tasksCompleted: "3 of 3 tasks completed",
      timeSpentMinutes: 999,
      aiSummary: "Contradictory stale summary that says no work was submitted.",
      strength: "Unsupported generic praise.",
      weakness: "Incorrectly says all deliverables are missing.",
    },
    offer: null,
    notes: [],
    activity: [],
    ...overrides,
  };
}

describe("candidateInsights", () => {
  it("derives factual insights from current application and submission data", () => {
    expect(candidateInsights(candidate())).toEqual([
      { label: "Relevant skills", value: "SQL · Python · Power BI (profile)" },
      { label: "Submitted in 1h 14m" },
      { label: "15 hours/week availability" },
      { label: "2 submitted files" },
    ]);
  });

  it("builds the assistive summary from current facts instead of stale free-form AI text", () => {
    const insights = candidateInsights(candidate());
    expect(JSON.stringify(insights)).not.toContain("Completed");
    expect(JSON.stringify(insights)).not.toContain("no work was submitted");
  });

  it("reports incomplete work without inventing a fit judgment", () => {
    const detail = candidate({
      submission: {
        id: "submission-2",
        submittedAt: new Date("2026-08-30T10:30:00.000Z"),
        notes: "Written response only",
        artifacts: [],
        submissionArtifacts: [],
        aiUsageMode: "controlled",
      },
      evidence: {
        tasksCompleted: "1/3",
        timeSpentMinutes: 30,
        aiSummary: "Great candidate",
        strength: "Strong fit",
        weakness: "None",
      },
    });

    expect(JSON.stringify(candidateInsights(detail))).not.toContain("Completed");
    expect(candidateSummaryUnavailableMessage(detail)).toContain("written submission is available");
  });

  it("describes a same-minute submission without showing a misleading zero duration", () => {
    const detail = candidate({
      submission: {
        id: "submission-3",
        submittedAt: new Date("2026-08-30T10:00:30.000Z"),
        notes: "Written response",
        artifacts: [],
        submissionArtifacts: [],
        aiUsageMode: "open",
      },
    });

    expect(candidateInsights(detail)).toContainEqual({ label: "Submitted in under 1m" });
  });

  it("refuses to summarize inconsistent task evidence", () => {
    const detail = candidate({
      evidence: {
        tasksCompleted: "4/4",
        timeSpentMinutes: 30,
        aiSummary: "All tasks complete",
        strength: "Strong fit",
        weakness: "None",
      },
    });

    expect(candidateInsights(detail)).not.toContainEqual(expect.objectContaining({ label: expect.stringContaining("Completed") }));
    expect(candidateSummaryUnavailableMessage(detail)).toBe(
      "Submission files are available, but there is not enough evaluated evidence yet to generate a reliable summary.",
    );
  });

  it("summarizes available evaluated material cautiously when task progress is not machine-verifiable", () => {
    const detail = candidate({
      evidence: {
        tasksCompleted: "Candidate discussed the three required tasks in the submission.",
        timeSpentMinutes: 30,
        aiSummary: "Unsupported assessment",
        strength: "Unsupported assessment",
        weakness: "Unsupported assessment",
      },
    });

    expect(candidateInsights(detail)).toContainEqual({ label: "2 submitted files" });
    expect(JSON.stringify(candidateInsights(detail))).not.toContain("Completed");
  });
  it("does not substitute application time for challenge start time", () => {
    expect(candidateInsights(candidate({ challengeStartedAt: null })).some((i) => i.label.startsWith("Submitted in"))).toBe(false);
  });
});
