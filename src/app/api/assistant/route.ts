import { z } from "zod";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, streamText } from "ai";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { getModel } from "@/lib/ai/gemma-provider";
import { buildCompanyHiringFacts, buildInternshipFacts } from "@/lib/company/internship-facts";
import { classifyAssistantRequest } from "@/lib/ai/assistant-router";
import {
  CHALLENGE_POLICY,
  attachDraftIdentity,
  buildDesignSummary,
  buildEmployerContext,
  generateChallengeDraftObject,
  generateClarificationQuestions,
} from "@/lib/ai/challenge-generation";
import { latestChallengeDraft, latestQuestionnaireAnswers, transcriptOf } from "@/lib/ai/assistant-conversation";
import type { AssistantUIMessage } from "@/lib/ai/assistant-messages";

// Generous, not arbitrary: generateChallengeDraftObject makes up to 3
// attempts at 75s each (225s worst case) plus context-building and the
// closing ack call. 280 stays under Vercel's current 300s ceiling with
// margin. The old value (60) was shorter than a single normal attempt —
// the Vercel function was being killed mid-generation, which is what
// actually produced the generic "An error occurred".
export const maxDuration = 280;

const RequestSchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())),
  opportunityId: z.string().uuid().nullable(),
});

const SCOPE_POLICY = `Ask internIn is a specialized internship hiring and internship-program assistant. It helps employers with workflows connected to: internship creation, internship challenges, applicants, candidate evidence, CVs, portfolios, hiring pipelines, evaluation criteria, recruiting, offers, hiring communication, internship program setup, internship analytics, company hiring data, and internIn's own features.

Never fabricate: internship details, applicants, company policies, candidate evidence, or challenge results. Never frame candidate evaluation in absolute terms ("definitely hire", "guaranteed top performer", a success percentage) and never rank candidates across different, unrelated internships. Hiring decisions are always the human's. Never display your internal reasoning, a "chain of thought", or a numbered reasoning process. Keep answers short and plain; use markdown only when it genuinely helps readability.`;

export async function POST(req: Request) {
  // Real stage timing, not a guess — logged so a slow request is
  // diagnosable from Vercel function logs instead of speculated about.
  // The generation calls themselves log their own per-attempt timing (see
  // withGenerateRetries in challenge-generation.ts).
  const t0 = Date.now();
  const requestId = crypto.randomUUID();

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
  console.log(`[assistant] requestId=${requestId} auth completed at +${Date.now() - t0}ms`);

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
  console.log(`[assistant] requestId=${requestId} body parsed at +${Date.now() - t0}ms, ${messages.length} messages`);

  const stream = createUIMessageStream<AssistantUIMessage>({
    execute: async ({ writer }) => {
      // Deterministic continuation: the Questionnaire's own submit button
      // IS the decision to proceed to drafting — no classification needed,
      // the workflow's own state already guarantees this. This branch
      // never runs for ordinary chat messages (only when the client sets
      // this exact metadata from a real questionnaire submit).
      const forcedAnswers = latestQuestionnaireAnswers(messages);
      if (forcedAnswers) {
        const generationId = crypto.randomUUID();
        const originalRequest = transcriptOf(messages.slice(0, -1)).split("\n").find((line) => line.startsWith("Employer:")) ?? "Internship role described in this conversation";
        console.log(`[assistant] requestId=${requestId} generationId=${generationId} trigger=questionnaire generation start at +${Date.now() - t0}ms`);

        writer.write({ type: "data-progress", id: "progress", data: { label: "Designing your challenge…" } });
        let draft;
        try {
          const context = await buildEmployerContext({ originalRequest, transcript: transcriptOf(messages), answers: forcedAnswers });
          const existingDraft = latestChallengeDraft(messages);
          const generated = await generateChallengeDraftObject({ context, existingDraft, revisionInstruction: existingDraft ? "Incorporate the employer's latest answers." : undefined });
          draft = attachDraftIdentity(generated, existingDraft);
        } catch (error) {
          console.error(`[assistant] requestId=${requestId} generationId=${generationId} generation failed at +${Date.now() - t0}ms:`, error instanceof Error ? error.message : error);
          throw new Error("We couldn't finish generating the challenge. Your answers are saved — try again.");
        }

        writer.write({ type: "data-designSummary", id: "designing", data: { lines: buildDesignSummary(draft) } });
        writer.write({ type: "data-challengeDraft", id: crypto.randomUUID(), data: draft });
        console.log(`[assistant] requestId=${requestId} generationId=${generationId} generation complete at +${Date.now() - t0}ms draftId=${draft.id} taskCount=${draft.tasks.length}`);

        writer.merge(
          streamText({
            model: getModel(),
            system: `You just designed an internship challenge draft titled "${draft.title}" based on the employer's answers. Write exactly one short, natural sentence introducing it (e.g. "I've drafted the challenge based on your answers. Review it below — nothing has been published yet."). The app renders the draft itself as a real, editable component below — do not restate or summarize its contents.`,
            prompt: "Write the introductory sentence now.",
          }).toUIMessageStream(),
        );
        return;
      }

      // ONE canonical routing decision, forced structured output (see
      // assistant-router.ts) — this is the fix for a real, reproduced
      // regression where agentic tool-calling let the model skip
      // askClarifyingQuestions entirely and narrate clarification
      // questions as plain numbered Markdown instead. There is no code
      // path below where the model can emit clarification questions or a
      // challenge draft as text: every action is a deterministic branch
      // that calls the real generation pipeline directly and writes the
      // structured data part itself. Also removes the need for the old
      // "questionnaireAsked"/"draftGenerated" duplicate-call guards —
      // there is now exactly one classification and one branch per
      // request, so a duplicate call within a single turn is structurally
      // impossible rather than merely rejected at runtime.
      const transcript = transcriptOf(messages);
      let decision;
      try {
        decision = await classifyAssistantRequest(transcript);
      } catch (error) {
        console.error(`[assistant] requestId=${requestId} routing classification failed at +${Date.now() - t0}ms:`, error instanceof Error ? error.message : error);
        throw new Error("Couldn't get an answer — try again.");
      }
      console.log(`[assistant] requestId=${requestId} classified action=${decision.action} at +${Date.now() - t0}ms`);

      if (decision.action === "decline") {
        writer.merge(
          streamText({
            model: getModel(),
            system: `${SCOPE_POLICY}\n\nThis request is clearly unrelated to internship hiring. Decline briefly (one sentence) and redirect toward what you can actually help with — do not fulfill the unrelated request.`,
            messages: await convertToModelMessages(messages),
          }).toUIMessageStream(),
        );
        return;
      }

      if (decision.action === "chat") {
        writer.merge(
          streamText({
            model: getModel(),
            system: SCOPE_POLICY,
            messages: await convertToModelMessages(messages),
          }).toUIMessageStream(),
        );
        return;
      }

      if (decision.action === "check_data") {
        writer.write({ type: "data-step", id: "load", data: { label: `Checking ${scopeLabel}`, status: "active" } });
        const facts = opportunityId ? await buildInternshipFacts(opportunityId, membership.companyId) : await buildCompanyHiringFacts(membership.companyId);
        writer.write({ type: "data-step", id: "load", data: { label: `Checked ${scopeLabel}`, description: facts.split("\n")[0], status: "complete" } });
        console.log(`[assistant] requestId=${requestId} check_data complete at +${Date.now() - t0}ms`);
        writer.merge(
          streamText({
            model: getModel(),
            system: `${SCOPE_POLICY}\n\nAnswer using ONLY the real data below — never invent, estimate, or round a figure it doesn't give you.\n\nReal data about ${scopeLabel}:\n${facts}`,
            messages: await convertToModelMessages(messages),
          }).toUIMessageStream(),
        );
        return;
      }

      if (decision.action === "ask_clarifying_questions") {
        writer.write({ type: "data-progress", id: "progress", data: { label: "Preparing a few questions…" } });
        const roleSummary = decision.roleSummary ?? transcript;
        let questions;
        try {
          questions = await generateClarificationQuestions({ roleSummary, transcript });
        } catch (error) {
          console.error(`[assistant] requestId=${requestId} ask_clarifying_questions failed at +${Date.now() - t0}ms:`, error instanceof Error ? error.message : error);
          throw new Error("We couldn't prepare the clarification form — try again.");
        }
        console.log(`[assistant] requestId=${requestId} ask_clarifying_questions complete at +${Date.now() - t0}ms questions=${questions.questions.length}`);
        const id = crypto.randomUUID();
        writer.write({ type: "data-questionnaire", id, data: questions });
        writer.merge(
          streamText({
            model: getModel(),
            system: `Write exactly one short, natural sentence telling the employer you need a few details before building the challenge (e.g. "I can help with that — I just need a few details first."). The app renders the actual questions as a real form below — do NOT list, number, or restate them yourself.`,
            prompt: "Write the introductory sentence now.",
          }).toUIMessageStream(),
        );
        return;
      }

      // decision.action === "draft_challenge"
      const generationId = crypto.randomUUID();
      console.log(`[assistant] requestId=${requestId} generationId=${generationId} trigger=draft_challenge at +${Date.now() - t0}ms`);
      writer.write({ type: "data-progress", id: "progress", data: { label: "Designing your challenge…" } });
      let draft;
      try {
        const existingDraft = latestChallengeDraft(messages);
        const context = await buildEmployerContext({ originalRequest: decision.roleSummary ?? transcript, transcript, answers: null });
        const generated = await generateChallengeDraftObject({ context, existingDraft, revisionInstruction: decision.revisionInstruction ?? undefined });
        draft = attachDraftIdentity(generated, existingDraft);
      } catch (error) {
        console.error(`[assistant] requestId=${requestId} generationId=${generationId} generation failed at +${Date.now() - t0}ms:`, error instanceof Error ? error.message : error);
        throw new Error("We couldn't finish generating the challenge — try again.");
      }

      writer.write({ type: "data-designSummary", id: "designing", data: { lines: buildDesignSummary(draft) } });
      writer.write({ type: "data-challengeDraft", id: crypto.randomUUID(), data: draft });
      console.log(`[assistant] requestId=${requestId} generationId=${generationId} generation complete at +${Date.now() - t0}ms draftId=${draft.id} taskCount=${draft.tasks.length}`);
      writer.merge(
        streamText({
          model: getModel(),
          system: `You just designed an internship challenge draft titled "${draft.title}". ${CHALLENGE_POLICY}\n\nWrite exactly one short, natural sentence introducing it (e.g. "Here's a draft based on what you described."). The app renders the draft itself as a real, editable component below — do not restate or summarize its contents.`,
          prompt: "Write the introductory sentence now.",
        }).toUIMessageStream(),
      );
    },
    onError: (error) => (error instanceof Error ? error.message : "Couldn't get an answer — try again."),
  });

  return createUIMessageStreamResponse({ stream });
}
