import { describe, it, expect } from "vitest";
import { transcriptOf, latestActionOfferChoice, latestChallengeDraft, latestQuestionnaireAnswers, latestQuestionnaireSubmission } from "./assistant-conversation";
import type { AssistantUIMessage } from "./assistant-messages";
import type { ChallengeDraft } from "./challenge-clarification-schemas";

function userMessage(overrides: Partial<AssistantUIMessage> = {}): AssistantUIMessage {
  return {
    id: "u1",
    role: "user",
    parts: [{ type: "text", text: "I want a student to work in a database role" }],
    ...overrides,
  } as AssistantUIMessage;
}

function minimalDraft(title: string): ChallengeDraft {
  return {
    id: "draft-1",
    status: "draft",
    version: 1,
    title,
    role: "Database Intern",
    scenario: "A fictional retail company has messy customer data that needs investigation.",
    skills: ["SQL"],
    deliverables: ["SQL scripts"],
    materials: [],
    tasks: [{ id: "t1", title: "Write queries", instructions: "Write SQL to find duplicates.", deliverableType: "code" }],
    durationMinutes: 60,
    rubric: [{ id: "r1", criterion: "SQL correctness", weight: 100, description: "Queries are correct." }],
    assumptions: [],
    safetyNotes: [],
  };
}

describe("transcriptOf", () => {
  it("labels user/assistant text parts and drops parts with no text", () => {
    const messages = [
      userMessage(),
      { id: "a1", role: "assistant", parts: [{ type: "text", text: "Sure, one moment." }] } as AssistantUIMessage,
      { id: "u2", role: "user", parts: [{ type: "data-questionnaire", id: "q1", data: {} }] } as AssistantUIMessage,
    ];
    const transcript = transcriptOf(messages);
    expect(transcript).toBe("Employer: I want a student to work in a database role\nAssistant: Sure, one moment.");
  });
});

describe("latestChallengeDraft", () => {
  it("returns null when no draft exists yet", () => {
    expect(latestChallengeDraft([userMessage()])).toBeNull();
  });

  it("returns the MOST RECENT draft when a conversation has revised one", () => {
    const first = minimalDraft("First draft");
    const second = minimalDraft("Revised draft");
    const messages = [
      userMessage(),
      { id: "a1", role: "assistant", parts: [{ type: "data-challengeDraft", id: "d1", data: first }] } as AssistantUIMessage,
      { id: "u2", role: "user", parts: [{ type: "text", text: "make it easier" }] } as AssistantUIMessage,
      { id: "a2", role: "assistant", parts: [{ type: "data-challengeDraft", id: "d2", data: second }] } as AssistantUIMessage,
    ];
    expect(latestChallengeDraft(messages)?.title).toBe("Revised draft");
  });
});

describe("latestQuestionnaireAnswers", () => {
  it("returns null for an ordinary chat message (no metadata)", () => {
    expect(latestQuestionnaireAnswers([userMessage()])).toBeNull();
  });

  it("returns null when the last message is from the assistant, even with stray metadata", () => {
    const messages = [
      userMessage(),
      { id: "a1", role: "assistant", parts: [], metadata: { intent: "questionnaire_answer", questionnaireAnswers: [] } } as AssistantUIMessage,
    ];
    expect(latestQuestionnaireAnswers(messages)).toBeNull();
  });

  it("returns the structured answers when the last user message is a real questionnaire submit", () => {
    const messages = [
      userMessage(),
      {
        id: "u2",
        role: "user",
        parts: [{ type: "text", text: "Answered 2 clarification questions." }],
        metadata: {
          intent: "questionnaire_answer",
          questionnaireContinuation: "offer_next_action",
          roleSummary: "Database Intern",
          questionnaireAnswers: [
            { prompt: "Which database?", answer: "PostgreSQL" },
            { prompt: "Experience level?", answer: null },
          ],
        },
      } as AssistantUIMessage,
    ];
    const answers = latestQuestionnaireAnswers(messages);
    expect(answers).toHaveLength(2);
    expect(answers?.[1].answer).toBeNull();
    expect(latestQuestionnaireSubmission(messages)).toMatchObject({
      continuation: "offer_next_action",
      roleSummary: "Database Intern",
    });
  });
});

describe("latestActionOfferChoice", () => {
  it("carries the structured questionnaire selections through the create button", () => {
    const answers = [{
      prompt: "Technologies?",
      slot: "tools_technologies" as const,
      answer: "React, TypeScript",
      values: ["React", "TypeScript"],
    }];
    const result = latestActionOfferChoice([userMessage({
      metadata: {
        intent: "create_internship_draft",
        roleSummary: "Web Developer Intern",
        questionnaireAnswers: answers,
        generationWorkNeed: {
          originalRequest: "We need React interfaces connected to APIs.",
          explicitRoleTitle: null,
          problems: [],
          activities: ["build React interfaces", "connect interfaces to APIs"],
          domainSignals: ["web software development"],
          systemsOrTools: ["React", "APIs"],
          desiredOutcomes: [],
          constraints: [],
          activityClarity: "clear",
          domainClarity: "clear",
          seniorityIntent: "intern/junior",
        },
      },
    })]);

    expect(result).toEqual({
      kind: "create_internship_draft",
      roleSummary: "Web Developer Intern",
      answers,
      workNeed: {
        originalRequest: "We need React interfaces connected to APIs.",
        explicitRoleTitle: null,
        problems: [],
        activities: ["build React interfaces", "connect interfaces to APIs"],
        domainSignals: ["web software development"],
        systemsOrTools: ["React", "APIs"],
        desiredOutcomes: [],
        constraints: [],
        activityClarity: "clear",
        domainClarity: "clear",
        seniorityIntent: "intern/junior",
      },
    });
  });
});
