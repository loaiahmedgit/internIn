import { z } from "zod";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, generateObject, stepCountIs, streamText, tool } from "ai";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { getModel } from "@/lib/ai/gemma-provider";
import { buildCompanyHiringFacts, buildInternshipFacts } from "@/lib/company/internship-facts";
import { ChallengeDraftSchema, ClarificationQuestionsResultSchema, type ChallengeDraft } from "@/lib/ai/challenge-clarification-schemas";
import type { AssistantUIMessage } from "@/lib/ai/assistant-messages";

export const maxDuration = 60;

const RequestSchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())),
  opportunityId: z.string().uuid().nullable(),
});

/** Every text part across the conversation, in order — the raw material
 * the clarification/drafting tools reason over. Kept separate from
 * convertToModelMessages() because those two inner calls want plain text
 * context, not the full ModelMessage/tool-call structure the outer call
 * needs. */
function transcriptOf(messages: AssistantUIMessage[]): string {
  return messages
    .map((m) => {
      const text = m.parts
        .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
        .map((p) => p.text)
        .join(" ")
        .trim();
      return text ? `${m.role === "user" ? "Employer" : "Assistant"}: ${text}` : null;
    })
    .filter((line): line is string => line !== null)
    .join("\n");
}

/** The most recent challenge draft already produced in this conversation,
 * if any — so a revision request ("make it easier") edits the SAME draft
 * instead of starting a disconnected new one. */
function latestChallengeDraft(messages: AssistantUIMessage[]): ChallengeDraft | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const part = messages[i].parts.find((p): p is Extract<typeof p, { type: "data-challengeDraft" }> => p.type === "data-challengeDraft");
    if (part) return part.data;
  }
  return null;
}

const SCOPE_POLICY = `Ask internIn is a specialized internship hiring and internship-program assistant. It helps employers with workflows connected to: internship creation, internship challenges, applicants, candidate evidence, CVs, portfolios, hiring pipelines, evaluation criteria, recruiting, offers, hiring communication, internship program setup, internship analytics, company hiring data, and internIn's own features.

It is NOT a general-purpose assistant. Decline clearly unrelated requests briefly and redirect toward what you can actually help with — e.g. a request to write an unrelated game or story gets a short decline, not the content. A request that USES a similar format but serves a real internship-hiring purpose (e.g. "create a Snake-style coding challenge for our software engineering intern") is in scope and should be helped.

Never fabricate: internship details, applicants, company policies, candidate evidence, or challenge results. If you don't have real data for a claim, say so or use a tool — never state "I checked X" unless you actually did.

Never frame candidate evaluation in absolute terms ("definitely hire", "guaranteed top performer", a success percentage) and never rank candidates across different, unrelated internships. Hiring decisions are always the human's.`;

const CHALLENGE_POLICY = `When an employer describes an internship role (even vaguely) and wants a work challenge / assessment / task for it, you can help design one — this is core to what you do.

A challenge is a realistic SIMULATION of the actual internship work, never a generic quiz. Depending on the profession, mix practical tasks, a scenario, open-ended questions, choice questions, code, spreadsheet work, design work, file/document review, or a written deliverable — whatever fits the real work, never one uniform question type for every role.

Before drafting, decide honestly whether you already have enough concrete context (what they'll actually do day to day, tools/tech involved, and anything that affects difficulty, required competencies, safety, or scope). If the employer's own message already gives that, call draftOrReviseChallenge directly — do not force a questionnaire out of habit. If a genuinely important detail is missing and guessing it would change the assessment's substance (safety, difficulty, competencies tested, format, responsibilities, seniority, deliverable), call askClarifyingQuestions instead, with 2-4 short, plain-language, non-jargon questions about the actual work — never invent that missing substance yourself. You may infer obvious organizational presentation details, never substantive responsibilities.

For safety-sensitive professions (healthcare, pharmacy, legal, cybersecurity, engineering, etc.), only ever design SAFE SIMULATED tasks using synthetic/fictional data — documentation, prioritization, escalation judgment, safe procedural scenarios. Never have a candidate perform real diagnosis, real prescribing/dispensing, real unsupervised clinical decisions, a real attack on a real system, or present output as real legal/medical advice.

Rubric criteria must be observable and job-relevant (e.g. "SQL correctness — 30%"), never vague or unrelated to the defined task (never "culture fit", "confidence", appearance, or any protected/personal characteristic). Difficulty should match an internship level, not a seasoned professional, unless the employer asks otherwise.

Once a draft exists, keep revising the SAME draft as the employer gives feedback ("make it easier", "remove the second task", "add an Excel part") — call draftOrReviseChallenge again for that, don't start over. A draft is never published or saved automatically; the employer reviews and explicitly saves it.`;

/**
 * Streaming backend for "Ask internIn". Whether real workspace data gets
 * queried, clarifying questions get asked, or a challenge gets drafted are
 * all genuine model decisions (real AI SDK tool calls, toolChoice "auto"),
 * never server-side keyword guesses — see each tool's description for the
 * actual routing instruction, and SCOPE_POLICY/CHALLENGE_POLICY above for
 * the behavioral rules enforced server-side, not just in UI copy.
 */
export async function POST(req: Request) {
  // Auth and body validation happen before the stream starts, so a failure
  // here can't be surfaced through createUIMessageStream's onError (that
  // only covers errors inside execute) — without this try/catch, an
  // unauthenticated or malformed request fell through to Next's default
  // framework 500 with an empty body, which useChat then reported as a
  // blank, unreadable error.
  let membership: Awaited<ReturnType<typeof requireCurrentCompanyMember>>["membership"];
  try {
    ({ membership } = await requireCurrentCompanyMember("hiring_reviewer"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not signed in.";
    return new Response(message, { status: 401 });
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await req.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Malformed request.";
    return new Response(message, { status: 400 });
  }

  const messages = body.messages as unknown as AssistantUIMessage[];
  const opportunityId = body.opportunityId;
  const scopeLabel = opportunityId ? "this internship's pipeline" : "your hiring workspace";

  const stream = createUIMessageStream<AssistantUIMessage>({
    execute: async ({ writer }) => {
      // A single no-argument tool scoped to whatever the composer's context
      // selector currently points at. No LLM-supplied parameters — the
      // company/internship scope is never something the model should
      // control, only whether to look at it at all. The data-step parts
      // that drive the "How I checked this" disclosure are written from
      // INSIDE execute(), so they only ever appear when the model actually
      // decides to call this — never unconditionally.
      const checkWorkspaceData = tool({
        description: opportunityId
          ? "Look up real, current data about this specific internship: applicant counts, review/shortlist/offer stage breakdown, application deadline, challenge status, and recent activity. Call this ONLY when the hiring manager's question genuinely needs real data about this internship. Never call it for greetings, small talk, thanks, or general questions about how internIn or hiring concepts work."
          : "Look up real, current hiring data across the whole company: active internship count, applicant/review/offer counts, weekly application activity, and internships closing soon. Call this ONLY when the hiring manager's question genuinely needs real workspace data. Never call it for greetings, small talk, thanks, or general questions about how internIn or hiring concepts work.",
        inputSchema: z.object({}),
        execute: async () => {
          writer.write({ type: "data-step", id: "load", data: { label: `Checking ${scopeLabel}`, status: "active" } });
          const facts = opportunityId
            ? await buildInternshipFacts(opportunityId, membership.companyId)
            : await buildCompanyHiringFacts(membership.companyId);
          writer.write({
            type: "data-step",
            id: "load",
            data: { label: `Checked ${scopeLabel}`, description: facts.split("\n")[0], status: "complete" },
          });
          return facts;
        },
      });

      // Structured-output tools: the model only ever gets back a short ack
      // (so it can write a normal sentence around the result); the real
      // payload goes straight to the client as a data part. The model
      // never generates the questionnaire/draft JSX or JSON prose itself —
      // only this server-controlled generateObject call does, validated
      // against the real Zod schema before anything is rendered.
      const askClarifyingQuestions = tool({
        description:
          "Ask the employer 2-4 short clarification questions before drafting an internship challenge, when their description leaves out details that would materially change the assessment (the actual day-to-day work, tools/tech, safety-relevant scope, seniority). Call this BEFORE draftOrReviseChallenge whenever real substantive context is missing. Do not call this if the employer's description already gives enough concrete detail — call draftOrReviseChallenge directly instead.",
        inputSchema: z.object({
          roleSummary: z.string().describe("One sentence summarizing the internship role/work as described so far"),
        }),
        execute: async ({ roleSummary }) => {
          const { object } = await generateObject({
            model: getModel(),
            schema: ClarificationQuestionsResultSchema,
            system: `You write short, plain-language clarification questions for a hiring manager who wants an internship work challenge designed. Prefer fixed choices when likely answers are predictable; use freeform when they aren't. Offer an "Other" choice when the fixed options might not cover it. Avoid HR jargon (say "What will they spend most of their time doing?", never "Select the primary competency domain"). 2-4 questions only.`,
            prompt: `Internship role so far: ${roleSummary}\n\nFull conversation:\n${transcriptOf(messages)}`,
            abortSignal: AbortSignal.timeout(45_000),
          });
          const id = crypto.randomUUID();
          writer.write({ type: "data-questionnaire", id, data: object });
          return { askedQuestionCount: object.questions.length };
        },
      });

      const draftOrReviseChallenge = tool({
        description:
          "Create or update a realistic, structured internship challenge draft (never a flat quiz) once there's enough real context about the actual work — either because the employer's description already had it, or clarifying questions were just answered. If a draft already exists in this conversation and the employer is giving feedback on it (\"make it easier\", \"remove a task\", \"add an Excel part\"), this updates that SAME draft using their feedback.",
        inputSchema: z.object({
          roleSummary: z.string().describe("One sentence summarizing the internship role/work"),
        }),
        execute: async ({ roleSummary }) => {
          const existingDraft = latestChallengeDraft(messages);
          const { object } = await generateObject({
            model: getModel(),
            schema: ChallengeDraftSchema,
            system: `${CHALLENGE_POLICY}\n\nReturn the FULL challenge draft object (not a diff), reusing everything from the current draft that the employer didn't ask to change.`,
            prompt: existingDraft
              ? `Internship role: ${roleSummary}\n\nCurrent draft (JSON):\n${JSON.stringify(existingDraft)}\n\nFull conversation (the latest employer message is the revision instruction):\n${transcriptOf(messages)}`
              : `Internship role: ${roleSummary}\n\nFull conversation so far (includes any clarification Q&A):\n${transcriptOf(messages)}`,
            abortSignal: AbortSignal.timeout(60_000),
          });
          const id = crypto.randomUUID();
          writer.write({ type: "data-challengeDraft", id, data: object });
          return { title: object.title, sectionCount: object.sections.length };
        },
      });

      const result = streamText({
        model: getModel(),
        system: `You are internIn's hiring assistant, embedded in a company's hiring dashboard.

${SCOPE_POLICY}

${CHALLENGE_POLICY}

You have three tools:
- checkWorkspaceData: looks up real, current facts about ${scopeLabel}. Call it ONLY when the message actually requires real workspace data (applicant counts, stages, deadlines, activity, an internship's status). For a greeting, thanks, small talk, "what can you do?", or a general question, answer directly — do NOT call it.
- askClarifyingQuestions: see above.
- draftOrReviseChallenge: see above.

When you call checkWorkspaceData, treat its result as the ONLY source for any number, date, or count in your answer — never invent, estimate, or round a figure it didn't give you. When askClarifyingQuestions or draftOrReviseChallenge run, the app renders the real structured result itself — you don't need to restate it in prose, just write one short natural sentence around it (e.g. "I can turn that into a realistic work challenge. I just need a few details first." before a questionnaire, or "Here's a draft based on what you described." before a challenge card).

Never display your internal reasoning, a "chain of thought", or a numbered reasoning process. Keep ordinary answers short and plain; use markdown only when it genuinely helps readability.`,
        messages: await convertToModelMessages(messages),
        tools: { checkWorkspaceData, askClarifyingQuestions, draftOrReviseChallenge },
        // Default stopWhen is isStepCount(1), which would end the reply
        // right after a tool call with no text — this allows the model to
        // call a tool, see the result, and still write a real answer.
        stopWhen: stepCountIs(4),
      });

      writer.merge(result.toUIMessageStream());
    },
    onError: (error) => (error instanceof Error ? error.message : "Couldn't get an answer — try again."),
  });

  return createUIMessageStreamResponse({ stream });
}
