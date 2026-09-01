import { z } from "zod";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, generateObject, stepCountIs, streamText, tool } from "ai";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { getModel } from "@/lib/ai/gemma-provider";
import { buildCompanyHiringFacts, buildInternshipFacts } from "@/lib/company/internship-facts";
import { ClarificationQuestionsResultSchema } from "@/lib/ai/challenge-clarification-schemas";
import { CHALLENGE_POLICY, CLARIFICATION_POLICY, buildDesignSummary, formatQuestionnaireAnswers, generateChallengeDraftObject } from "@/lib/ai/challenge-generation";
import { latestChallengeDraft, latestQuestionnaireAnswers, transcriptOf } from "@/lib/ai/assistant-conversation";
import type { AssistantUIMessage } from "@/lib/ai/assistant-messages";

// Generous, not arbitrary: a real draftOrReviseChallenge call has been
// observed taking ~90-130s on its own, and generateChallengeDraftObject
// can make two such attempts. The old value (60) was shorter than a single
// normal attempt — the Vercel function was being killed mid-generation,
// which is what actually produced the generic "An error occurred".
export const maxDuration = 240;

const RequestSchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())),
  opportunityId: z.string().uuid().nullable(),
});

const SCOPE_POLICY = `Ask internIn is a specialized internship hiring and internship-program assistant. It helps employers with workflows connected to: internship creation, internship challenges, applicants, candidate evidence, CVs, portfolios, hiring pipelines, evaluation criteria, recruiting, offers, hiring communication, internship program setup, internship analytics, company hiring data, and internIn's own features.

It is NOT a general-purpose assistant. Decline clearly unrelated requests briefly and redirect toward what you can actually help with — e.g. a request to write an unrelated game or story gets a short decline, not the content. A request that USES a similar format but serves a real internship-hiring purpose (e.g. "create a Snake-style coding challenge for our software engineering intern") is in scope and should be helped.

Never fabricate: internship details, applicants, company policies, candidate evidence, or challenge results. If you don't have real data for a claim, say so or use a tool — never state "I checked X" unless you actually did.

Never frame candidate evaluation in absolute terms ("definitely hire", "guaranteed top performer", a success percentage) and never rank candidates across different, unrelated internships. Hiring decisions are always the human's.`;

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
      // Deterministic continuation: the Questionnaire's own submit button
      // IS the decision to proceed to drafting — asking the model to
      // freely re-decide whether to draft here would be slower and less
      // reliable than the workflow's own state already guarantees. This
      // branch never runs for ordinary chat messages (only when the client
      // sets this exact metadata from a real questionnaire submit), so
      // plain conversation still goes through full model-driven routing
      // below untouched.
      const forcedAnswers = latestQuestionnaireAnswers(messages);
      if (forcedAnswers) {
        const roleSummary = transcriptOf(messages.slice(0, -1)).slice(-400) || "Internship role described in this conversation";
        const contextBlock = `The employer just answered clarification questions about this role:\n${formatQuestionnaireAnswers(forcedAnswers)}\n\nFull conversation so far:\n${transcriptOf(messages)}`;

        writer.write({ type: "data-step", id: "designing", data: { label: "Designing challenge…", status: "active" } });
        let draft;
        try {
          draft = await generateChallengeDraftObject({ roleSummary, contextBlock, existingDraft: latestChallengeDraft(messages) });
        } catch (error) {
          console.error("[assistant] deterministic draft generation failed:", error instanceof Error ? error.message : error);
          writer.write({ type: "data-step", id: "designing", data: { label: "Couldn't finish designing the challenge", status: "complete" } });
          throw new Error("We couldn't finish generating the challenge. Your answers are saved — try again.");
        }

        writer.write({ type: "data-step", id: "designing", data: { label: "Designed challenge", status: "complete" } });
        writer.write({ type: "data-designSummary", id: "designing", data: { lines: buildDesignSummary(draft) } });
        writer.write({ type: "data-challengeDraft", id: crypto.randomUUID(), data: draft });

        // One short, natural sentence introducing the draft the app just
        // rendered as a real component — never a restatement of its
        // contents, and no tools needed for this single sentence.
        const ack = streamText({
          model: getModel(),
          system: `You just designed an internship challenge draft titled "${draft.title}" based on the employer's answers. Write exactly one short, natural sentence introducing it (e.g. "Here's a draft based on what you told me."). The app renders the draft itself as a card below — do not restate or summarize its contents.`,
          prompt: "Write the introductory sentence now.",
        });
        writer.merge(ack.toUIMessageStream());
        return;
      }

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
            system: `You write short, plain-language clarification questions for a hiring manager who wants an internship work challenge designed. ${CLARIFICATION_POLICY} Avoid HR jargon (say "What will they spend most of their time doing?", never "Select the primary competency domain").`,
            prompt: `Internship role so far: ${roleSummary}\n\nFull conversation:\n${transcriptOf(messages)}`,
            abortSignal: AbortSignal.timeout(60_000),
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
          const draft = await generateChallengeDraftObject({
            roleSummary,
            contextBlock: `Full conversation so far (includes any clarification Q&A):\n${transcriptOf(messages)}`,
            existingDraft: latestChallengeDraft(messages),
          });
          writer.write({ type: "data-designSummary", id: "designing", data: { lines: buildDesignSummary(draft) } });
          writer.write({ type: "data-challengeDraft", id: crypto.randomUUID(), data: draft });
          return { title: draft.title, sectionCount: draft.sections.length };
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
