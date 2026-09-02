import { z } from "zod";
import { eq } from "drizzle-orm";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, streamText, type UIMessageStreamWriter } from "ai";
import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { getModel } from "@/lib/ai/gemma-provider";
import { buildCompanyHiringFacts, buildInternshipFacts } from "@/lib/company/internship-facts";
import { resolveOpportunityByName } from "@/lib/company/opportunity-lookup";
import { classifyAssistantRequest } from "@/lib/ai/assistant-router";
import { buildClarificationQuestions, resolveMissingSlots } from "@/lib/ai/clarification-engine";
import { getRoleProfile } from "@/lib/ai/role-profiles";
import { attachDraftIdentity, buildEmployerContext, generateChallengeDraftObject } from "@/lib/ai/challenge-generation";
import { saveChallengeDraftAction } from "@/lib/opportunities/challenge-draft-actions";
import { createOpportunityFromChallengeDraftAction } from "@/lib/opportunities/opportunity-from-challenge-actions";
import { saveInternshipAction, type InternshipFormInput } from "@/lib/opportunities/actions";
import {
  describeOpportunityEdit,
  generateOpportunityEditPatch,
  OpportunityEditPatchSchema,
  opportunityEditEntries,
  type OpportunityEditPatch,
} from "@/lib/ai/opportunity-edit";
import {
  latestChallengeDraft,
  latestQuestionnaireSubmission,
  latestActionOfferChoice,
  latestInternshipChoice,
  latestInternshipEditConfirmation,
  transcriptOf,
} from "@/lib/ai/assistant-conversation";
import type { AssistantUIMessage, QuestionnaireAnswer } from "@/lib/ai/assistant-messages";
import type { ChallengeDraft, EmployerContext } from "@/lib/ai/challenge-clarification-schemas";

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

const SCOPE_POLICY = `Ask internIn is a hiring copilot for internship teams — not just an AI challenge generator. It can converse about a hiring problem, look up real workspace/candidate/analytics data, and create or edit internship drafts and challenges. It helps employers with workflows connected to: internship creation, internship challenges, applicants, candidate evidence, CVs, portfolios, hiring pipelines, evaluation criteria, recruiting, offers, hiring communication, internship program setup, internship analytics, company hiring data, and internIn's own features.

Never fabricate: internship details, applicants, company policies, candidate evidence, or challenge results. Never frame candidate evaluation in absolute terms ("definitely hire", "guaranteed top performer", a success percentage) and never rank candidates across different, unrelated internships. Hiring decisions are always the human's. Never display your internal reasoning, a "chain of thought", or a numbered reasoning process. Keep answers short and plain; use markdown only when it genuinely helps readability. When drafting outreach/communication text for candidates, only ever draft it — internIn has no capability to send anything, so say so if asked to send it.`;

/** Writes a complete plain-text response part with no model call at all —
 * used when the text is already known (e.g. the router already generated
 * a clarification intro in the same structured call). Saves an entire
 * extra model round-trip for the most latency-sensitive path. */
function writePlainText(writer: UIMessageStreamWriter<AssistantUIMessage>, id: string, text: string) {
  writer.write({ type: "text-start", id });
  writer.write({ type: "text-delta", id, delta: text });
  writer.write({ type: "text-end", id });
}

/**
 * Generates a challenge draft, writes it to the stream, and RETURNS it
 * (or null on failure — the error part is already written) — the shared
 * body behind draft_challenge, "ask_clarifying_questions" resolving to
 * zero real questions, and the "Create challenge only" / "Create
 * internship draft" offer-card buttons. One implementation so "no minimum
 * number of clarification questions" and "internship draft bundles a
 * challenge" never have to duplicate the generation logic to stay true.
 */
async function runDraftChallenge(
  writer: UIMessageStreamWriter<AssistantUIMessage>,
  params: {
    requestId: string;
    t0: number;
    turnId: string;
    originalRequest: string;
    transcript: string;
    existingDraft: ChallengeDraft | null;
    revisionInstruction?: string;
    announce?: boolean;
    answers?: QuestionnaireAnswer[];
    roleHint?: string;
    progressLabel?: string;
  },
): Promise<{ draft: ChallengeDraft; context: EmployerContext } | null> {
  const {
    requestId,
    t0,
    turnId,
    originalRequest,
    transcript,
    existingDraft,
    revisionInstruction,
    announce = true,
    answers,
    roleHint,
    progressLabel = "Designing your challenge…",
  } = params;
  const generationId = crypto.randomUUID();
  console.log(`[assistant] requestId=${requestId} generationId=${generationId} trigger=draft_challenge at +${Date.now() - t0}ms`);
  writer.write({ type: "data-progress", id: "progress", data: { label: progressLabel } });
  let draft: ChallengeDraft;
  let context: EmployerContext;
  try {
    context = await buildEmployerContext({ originalRequest, transcript, answers: answers ?? null, roleHint });
    const generated = await generateChallengeDraftObject({ context, existingDraft, revisionInstruction });
    draft = attachDraftIdentity(generated, existingDraft);
  } catch (error) {
    console.error(`[assistant] requestId=${requestId} generationId=${generationId} generation failed at +${Date.now() - t0}ms:`, error instanceof Error ? error.message : error);
    writer.write({ type: "data-generationError", id: `error:${turnId}`, data: { message: "We couldn't finish generating the challenge — try again." } });
    return null;
  }

  console.log(`[assistant] requestId=${requestId} generationId=${generationId} generation complete at +${Date.now() - t0}ms draftId=${draft.id} taskCount=${draft.tasks.length}`);
  if (announce) {
    writer.write({ type: "data-challengeDraft", id: `challengeDraft:${turnId}`, data: draft });
    writePlainText(writer, `intro:${turnId}`, "Challenge draft ready\n\nHere's a draft challenge based on your request.");
  }
  return { draft, context };
}

/**
 * "Create internship draft" — the ONE-CLICK primary action (Part 4/5):
 * generates the challenge, then immediately wraps it into a real
 * internship draft via the exact same pipeline "Create internship from
 * this draft" already uses, and tells the client where to land. No
 * intermediate "here's a bare Challenge Draft, now click through twice"
 * detour for this entry point.
 */
async function runCreateInternshipDraft(
  writer: UIMessageStreamWriter<AssistantUIMessage>,
  params: {
    requestId: string;
    t0: number;
    turnId: string;
    originalRequest: string;
    transcript: string;
    answers?: QuestionnaireAnswer[];
    roleHint?: string;
  },
) {
  const { requestId, t0, turnId } = params;
  const result = await runDraftChallenge(writer, {
    ...params,
    existingDraft: null,
    announce: false,
    progressLabel: "Preparing your internship draft…",
  });
  if (!result) return; // error part already written
  const { draft, context } = result;

  try {
    const { opportunityId: newOpportunityId, role } = await createOpportunityFromChallengeDraftAction(draft, context);
    console.log(`[assistant] requestId=${requestId} internship draft created opportunityId=${newOpportunityId} at +${Date.now() - t0}ms`);
    writer.write({ type: "data-internshipCreated", id: `internshipCreated:${turnId}`, data: { opportunityId: newOpportunityId, role } });
    writePlainText(writer, `intro:${turnId}`, `Your ${role} draft is ready to review.`);
  } catch (error) {
    console.error(`[assistant] requestId=${requestId} internship draft creation failed at +${Date.now() - t0}ms:`, error instanceof Error ? error.message : error);
    writer.write({
      type: "data-generationError",
      id: `error:${turnId}`,
      data: {
        title: "Internship draft creation failed",
        message: "The challenge is ready, but we couldn't create the internship draft — try again.",
      },
    });
  }
}

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
  // The triggering user message's own (client-generated, stable) id — used
  // to derive deterministic data-part ids below. If a retried/duplicated
  // request ever re-executes for the SAME logical turn (a network retry,
  // a reconnect), a second write with the SAME id updates the existing
  // part in place (AI SDK v5 data-part reconciliation) instead of adding
  // a second, independent part that would render as a duplicate
  // Questionnaire/ChallengeDraftCard.
  const turnId = messages.at(-1)?.id ?? requestId;
  console.log(`[assistant] requestId=${requestId} body parsed at +${Date.now() - t0}ms, ${messages.length} messages, turnId=${turnId}`);

  const stream = createUIMessageStream<AssistantUIMessage>({
    execute: async ({ writer }) => {
      // Deterministic continuations: a real UI click already made this
      // decision — never re-classify what an explicit submit/button press
      // already decided. Checked in order before any model routing call.

      const questionnaireSubmission = latestQuestionnaireSubmission(messages);
      if (questionnaireSubmission) {
        const { answers, continuation, roleSummary } = questionnaireSubmission;
        if (continuation === "offer_next_action") {
          writer.write({
            type: "data-actionOffer",
            id: `offer:${turnId}`,
            data: {
              roleSummary,
              generationAnswers: answers,
            },
          });
          writePlainText(writer, `intro:${turnId}`, `Thanks. I have enough context to prepare the ${roleSummary} hiring setup with a short practical challenge.`);
          return;
        }

        const generationId = crypto.randomUUID();
        const originalRequest = roleSummary;
        console.log(`[assistant] requestId=${requestId} generationId=${generationId} trigger=questionnaire generation start at +${Date.now() - t0}ms`);

        writer.write({ type: "data-progress", id: "progress", data: { label: "Designing your challenge…" } });
        let draft;
        try {
          // NOT transcriptOf(messages) here: the questionnaire's own
          // structured answers already carry everything EmployerContext
          // needs. Sending the full, ever-growing conversation transcript
          // on top of them was pure re-derivation.
          const context = await buildEmployerContext({ originalRequest, transcript: originalRequest, answers, roleHint: roleSummary });
          console.log(`[assistant] requestId=${requestId} generationId=${generationId} T1 employerContext ready at +${Date.now() - t0}ms`);
          const existingDraft = latestChallengeDraft(messages);
          const generated = await generateChallengeDraftObject({ context, existingDraft, revisionInstruction: existingDraft ? "Incorporate the employer's latest answers." : undefined });
          console.log(`[assistant] requestId=${requestId} generationId=${generationId} T4 draft object validated at +${Date.now() - t0}ms`);
          draft = attachDraftIdentity(generated, existingDraft);
        } catch (error) {
          console.error(`[assistant] requestId=${requestId} generationId=${generationId} generation failed at +${Date.now() - t0}ms:`, error instanceof Error ? error.message : error);
          writer.write({ type: "data-generationError", id: `error:${turnId}`, data: { message: "We couldn't finish generating the challenge. Your answers are saved — try again." } });
          return;
        }

        writer.write({ type: "data-challengeDraft", id: `challengeDraft:${turnId}`, data: draft });
        console.log(`[assistant] requestId=${requestId} generationId=${generationId} T5 draft written to client at +${Date.now() - t0}ms draftId=${draft.id} taskCount=${draft.tasks.length}`);
        writePlainText(writer, `intro:${turnId}`, "Challenge draft ready\n\nHere's a draft challenge based on your request.");
        return;
      }

      const offerChoice = latestActionOfferChoice(messages);
      if (offerChoice) {
        const originalRequest = offerChoice.roleSummary || transcriptOf(messages.slice(0, -1));
        if (offerChoice.kind === "create_challenge_only") {
          await runDraftChallenge(writer, {
            requestId,
            t0,
            turnId,
            originalRequest,
            transcript: transcriptOf(messages),
            existingDraft: latestChallengeDraft(messages),
            answers: offerChoice.answers,
            roleHint: offerChoice.roleSummary,
          });
        } else {
          await runCreateInternshipDraft(writer, {
            requestId,
            t0,
            turnId,
            originalRequest,
            transcript: transcriptOf(messages),
            answers: offerChoice.answers,
            roleHint: offerChoice.roleSummary,
          });
        }
        return;
      }

      const internshipChoice = latestInternshipChoice(messages);
      if (internshipChoice) {
        if (internshipChoice.operation === "edit_internship") {
          await runEditExistingInternship(writer, {
            requestId,
            t0,
            turnId,
            companyId: membership.companyId,
            opportunityId: internshipChoice.opportunityId,
            revisionInstruction: internshipChoice.revisionInstruction,
          });
        } else {
          await runEditExistingChallenge(writer, { requestId, t0, turnId, companyId: membership.companyId, opportunityId: internshipChoice.opportunityId, revisionInstruction: internshipChoice.revisionInstruction });
        }
        return;
      }

      const internshipEditConfirmation = latestInternshipEditConfirmation(messages);
      if (internshipEditConfirmation) {
        await applyExistingInternshipEdit(writer, {
          requestId,
          t0,
          turnId,
          companyId: membership.companyId,
          ...internshipEditConfirmation,
        });
        return;
      }

      // ONE canonical routing decision, forced structured output (see
      // assistant-router.ts). No agentic tool-calling: the model can
      // never emit clarification questions or a challenge draft as text —
      // every action below is a deterministic branch that calls the real
      // pipeline directly and writes the structured data part itself.
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
        writer.write({ type: "data-step", id: `load:${turnId}`, data: { label: `Checking ${scopeLabel}`, status: "active" } });
        const facts = opportunityId ? await buildInternshipFacts(opportunityId, membership.companyId) : await buildCompanyHiringFacts(membership.companyId);
        writer.write({ type: "data-step", id: `load:${turnId}`, data: { label: `Checked ${scopeLabel}`, description: facts.split("\n")[0], status: "complete" } });
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
        const normalizedRole = decision.normalizedRole ?? decision.roleSummary ?? "the described role";
        const missingSlots = resolveMissingSlots(decision.roleConfidence, decision.missingSlots);

        let questions;
        try {
          const profile = await getRoleProfile(normalizedRole);
          questions = buildClarificationQuestions(missingSlots, profile);
        } catch (error) {
          console.error(`[assistant] requestId=${requestId} ask_clarifying_questions failed at +${Date.now() - t0}ms:`, error instanceof Error ? error.message : error);
          throw new Error("We couldn't prepare the clarification form — try again.");
        }

        // No forced minimum: resolveMissingSlots can legitimately resolve
        // to zero questions — that means nothing was ACTUALLY worth
        // asking. Offer the next action directly instead of erroring or
        // asking anyway (mirrors offer_next_action below).
        if (!questions.length) {
          console.log(`[assistant] requestId=${requestId} ask_clarifying_questions resolved to zero real questions at +${Date.now() - t0}ms — offering next action`);
          const roleSummary = decision.roleSummary ?? normalizedRole;
          writer.write({ type: "data-actionOffer", id: `offer:${turnId}`, data: { roleSummary } });
          writePlainText(writer, `intro:${turnId}`, `I've got enough context. I can create an internship draft for the ${normalizedRole} role with a short practical challenge.`);
          return;
        }
        console.log(`[assistant] requestId=${requestId} ask_clarifying_questions complete at +${Date.now() - t0}ms role=${normalizedRole} questions=${questions.length}`);

        const latestEmployerText = messages.at(-1)?.parts
          .filter((part): part is Extract<(typeof messages)[number]["parts"][number], { type: "text" }> => part.type === "text")
          .map((part) => part.text)
          .join(" ") ?? "";
        const explicitlyChallengeOnly = /\b(challenge|assessment|work sample|screening task)\b/i.test(latestEmployerText);
        const continuation = opportunityId || decision.creationTarget === "challenge" || (decision.creationTarget == null && explicitlyChallengeOnly)
          ? "draft_challenge"
          : "offer_next_action";
        const intro = continuation === "draft_challenge"
          ? `I can help you design a challenge for the ${normalizedRole} role. I just need a few details first.`
          : `I can help you set up hiring for the ${normalizedRole} role. I just need a few details first.`;
        writer.write({
          type: "data-questionnaire",
          id: `questionnaire:${turnId}`,
          data: { intro, questions, continuation, roleSummary: decision.roleSummary ?? normalizedRole },
        });
        // No model call for this sentence at all — deterministic template,
        // instant, and the router already spent its one call on routing.
        writePlainText(writer, `intro:${turnId}`, intro);
        return;
      }

      if (decision.action === "offer_next_action") {
        // Enough context for a brand-new internship — offer the primary
        // action instead of silently generating a bare challenge (Part
        // 4/5: the internship is the primary hiring object, and the
        // employer should never be handed a technical fork this early).
        const normalizedRole = decision.normalizedRole ?? decision.roleSummary ?? "this role";
        const roleSummary = decision.roleSummary ?? normalizedRole;
        writer.write({ type: "data-actionOffer", id: `offer:${turnId}`, data: { roleSummary } });
        writePlainText(writer, `intro:${turnId}`, `I've got enough context. I can create an internship draft for the ${normalizedRole} role with a short practical challenge.`);
        return;
      }

      if (decision.action === "edit_existing_challenge") {
        await runEditExistingChallenge(writer, {
          requestId,
          t0,
          turnId,
          companyId: membership.companyId,
          targetRoleName: decision.targetRoleName ?? decision.roleSummary ?? "",
          revisionInstruction: decision.revisionInstruction ?? "Improve the challenge.",
        });
        return;
      }

      if (decision.action === "edit_existing_internship") {
        await runEditExistingInternship(writer, {
          requestId,
          t0,
          turnId,
          companyId: membership.companyId,
          targetRoleName: decision.targetRoleName ?? decision.roleSummary ?? "",
          revisionInstruction: decision.revisionInstruction ?? "Update the internship.",
        });
        return;
      }

      // decision.action === "draft_challenge" — an internship is already
      // in scope for this conversation (opportunityId set, or the
      // employer explicitly asked for a challenge only from the start),
      // or the employer already chose "create challenge only" earlier.
      await runDraftChallenge(writer, {
        requestId,
        t0,
        turnId,
        originalRequest: decision.roleSummary ?? transcript,
        transcript,
        existingDraft: latestChallengeDraft(messages),
        revisionInstruction: decision.revisionInstruction ?? undefined,
      });
    },
    onError: (error) => (error instanceof Error ? error.message : "Couldn't get an answer — try again."),
  });

  return createUIMessageStreamResponse({ stream });
}

/**
 * "Make the Database Intern challenge easier" from a general conversation
 * (not part of this conversation's own in-progress draft) — resolves the
 * NAMED internship, and either acts directly (exactly one real match),
 * asks a real question (a client-supplied opportunityId already resolved
 * it), or shows a genuine disambiguation choice (zero or several matches)
 * instead of guessing. Never creates a second challenge for that
 * internship — saveChallengeDraftAction finds and versions the existing
 * one by opportunityId, the same as every other challenge-save path.
 */
async function runEditExistingChallenge(
  writer: UIMessageStreamWriter<AssistantUIMessage>,
  params: { requestId: string; t0: number; turnId: string; companyId: string } & (
    | { targetRoleName: string; revisionInstruction: string; opportunityId?: undefined }
    | { opportunityId: string; revisionInstruction: string; targetRoleName?: undefined }
  ),
) {
  const { requestId, t0, turnId, companyId, revisionInstruction } = params;
  const db = getDb();

  let opportunityId: string;
  if ("opportunityId" in params && params.opportunityId) {
    opportunityId = params.opportunityId;
  } else {
    const matches = await resolveOpportunityByName(companyId, params.targetRoleName ?? "");
    if (matches.length === 0) {
      const all = await db.select({ id: schema.opportunities.id, role: schema.opportunities.role }).from(schema.opportunities).where(eq(schema.opportunities.companyId, companyId));
      writer.write({ type: "data-internshipChoice", id: `choice:${turnId}`, data: { options: all, revisionInstruction, operation: "edit_challenge" } });
      writePlainText(writer, `intro:${turnId}`, all.length ? `I couldn't find an internship called "${params.targetRoleName}". Which internship do you mean?` : "You don't have any internships yet — create one first.");
      return;
    }
    if (matches.length > 1) {
      writer.write({ type: "data-internshipChoice", id: `choice:${turnId}`, data: { options: matches, revisionInstruction, operation: "edit_challenge" } });
      writePlainText(writer, `intro:${turnId}`, "Which internship do you mean?");
      return;
    }
    opportunityId = matches[0].id;
  }

  const [opportunity] = await db.select().from(schema.opportunities).where(eq(schema.opportunities.id, opportunityId)).limit(1);
  if (!opportunity || opportunity.companyId !== companyId) {
    writer.write({
      type: "data-generationError",
      id: `error:${turnId}`,
      data: { title: "Challenge update failed", message: "That internship couldn't be found." },
    });
    return;
  }

  const [challengeRow] = await db.select().from(schema.challenges).where(eq(schema.challenges.opportunityId, opportunityId)).limit(1);
  let currentSummary = "";
  let existingDraft: ChallengeDraft | null = null;
  if (challengeRow?.currentVersionId) {
    const [version] = await db.select().from(schema.challengeVersions).where(eq(schema.challengeVersions.id, challengeRow.currentVersionId)).limit(1);
    if (version) {
      currentSummary = ` The current challenge is "${version.title}": ${version.scenario} It has these tasks: ${version.tasks.map((t) => t.title).join(", ")}.`;
      existingDraft = challengeDraftFromStoredVersion(opportunity.role, challengeRow.id, version);
    }
  }

  // Built directly from real DB fields — no model call to re-derive
  // context that already exists, and no fabricated company facts.
  const context: EmployerContext = {
    originalRequest: opportunity.role,
    role: opportunity.role,
    level: null,
    responsibilities: [],
    tools: opportunity.skills,
    restrictions: [],
    additionalContext: `${opportunity.description}${currentSummary} The employer wants this specific change: ${revisionInstruction}`,
  };

  writer.write({ type: "data-progress", id: "progress", data: { label: "Updating the challenge…" } });
  let draft: ChallengeDraft;
  try {
    const generated = await generateChallengeDraftObject({ context, existingDraft, revisionInstruction });
    draft = attachDraftIdentity(generated, existingDraft);
  } catch (error) {
    console.error(`[assistant] requestId=${requestId} edit_existing_challenge generation failed at +${Date.now() - t0}ms:`, error instanceof Error ? error.message : error);
    writer.write({
      type: "data-generationError",
      id: `error:${turnId}`,
      data: { title: "Challenge update failed", message: "We couldn't update the challenge. The existing version is unchanged." },
    });
    return;
  }

  try {
    await saveChallengeDraftAction(opportunityId, draft);
    writer.write({ type: "data-challengeDraft", id: `challengeDraft:${turnId}`, data: draft });
    writePlainText(writer, `intro:${turnId}`, `Updated the ${opportunity.role} challenge.\n\nReview it below — nothing has been published yet.`);
  } catch (error) {
    console.error(`[assistant] requestId=${requestId} edit_existing_challenge save failed at +${Date.now() - t0}ms:`, error instanceof Error ? error.message : error);
    writer.write({
      type: "data-generationError",
      id: `error:${turnId}`,
      data: { title: "Challenge update failed", message: "We generated the update but couldn't save it — try again." },
    });
  }
}

type StoredChallengeVersion = typeof schema.challengeVersions.$inferSelect;

function challengeDraftFromStoredVersion(role: string, challengeId: string, version: StoredChallengeVersion): ChallengeDraft {
  const parsedWeights = version.rubric.map((criterion) => {
    const match = criterion.criterion.match(/\((\d+)%\)\s*$/);
    return match ? Number(match[1]) : null;
  });
  const knownWeightTotal = parsedWeights.reduce<number>((sum, weight) => sum + (weight ?? 0), 0);
  const missingWeightCount = parsedWeights.filter((weight) => weight === null).length;
  const fallbackWeight = missingWeightCount > 0 ? Math.max(0, Math.floor((100 - knownWeightTotal) / missingWeightCount)) : 0;

  const aiUsagePolicyMode: ChallengeDraft["aiUsagePolicyMode"] =
    version.aiUsagePolicy === "open"
      ? "fully_allowed"
      : version.aiUsagePolicy === "restricted_ai"
        ? "research_only"
        : version.aiUsagePolicy === "controlled"
          ? "custom"
          : "allowed_with_disclosure";

  return {
    id: challengeId,
    version: version.versionNumber,
    status: "draft",
    role,
    title: version.title,
    scenario: version.scenario,
    skills: version.skills.length ? version.skills : [role],
    tasks: version.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      instructions: task.description,
      deliverableType: "other",
    })),
    materials: version.files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      type: "file",
      description: file.description,
    })),
    durationMinutes: version.estimatedMinutes,
    estimatedDurationLabel: version.estimatedDurationLabel,
    deliverables: version.deliverables,
    rubric: version.rubric.map((criterion, index) => ({
      id: crypto.randomUUID(),
      criterion: criterion.criterion.replace(/\s*\(\d+%\)\s*$/, ""),
      weight: parsedWeights[index] ?? fallbackWeight,
      description: criterion.description || undefined,
    })),
    aiUsagePolicyMode,
    aiUsagePolicyCustomText: version.aiUsagePolicy === "controlled" ? "Follow the existing controlled AI-use policy." : null,
    assumptions: [],
    safetyNotes: [],
  };
}

async function runEditExistingInternship(
  writer: UIMessageStreamWriter<AssistantUIMessage>,
  params: { requestId: string; t0: number; turnId: string; companyId: string } & (
    | { targetRoleName: string; revisionInstruction: string; opportunityId?: undefined }
    | { opportunityId: string; revisionInstruction: string; targetRoleName?: undefined }
  ),
) {
  const { requestId, t0, turnId, companyId, revisionInstruction } = params;
  const db = getDb();

  let opportunityId: string;
  if ("opportunityId" in params && params.opportunityId) {
    opportunityId = params.opportunityId;
  } else {
    const matches = await resolveOpportunityByName(companyId, params.targetRoleName ?? "");
    if (matches.length !== 1) {
      const options = matches.length > 1
        ? matches
        : await db.select({ id: schema.opportunities.id, role: schema.opportunities.role }).from(schema.opportunities).where(eq(schema.opportunities.companyId, companyId));
      writer.write({
        type: "data-internshipChoice",
        id: `choice:${turnId}`,
        data: { options, revisionInstruction, operation: "edit_internship" },
      });
      writePlainText(
        writer,
        `intro:${turnId}`,
        options.length
          ? matches.length === 0
            ? `I couldn't find an internship called "${params.targetRoleName}". Which internship do you mean?`
            : "Which internship do you mean?"
          : "You don't have any internships yet. Create one first.",
      );
      return;
    }
    opportunityId = matches[0].id;
  }

  const [opportunity] = await db
    .select()
    .from(schema.opportunities)
    .where(eq(schema.opportunities.id, opportunityId))
    .limit(1);
  if (!opportunity || opportunity.companyId !== companyId) {
    writer.write({
      type: "data-generationError",
      id: `error:${turnId}`,
      data: { title: "Internship update failed", message: "That internship couldn't be found." },
    });
    return;
  }

  writer.write({ type: "data-progress", id: "progress", data: { label: "Preparing the internship update…" } });
  const current = opportunitySnapshot(opportunity);
  let patch: OpportunityEditPatch;
  try {
    patch = await generateOpportunityEditPatch({ current, instruction: revisionInstruction });
  } catch (error) {
    console.error(`[assistant] requestId=${requestId} internship edit proposal failed at +${Date.now() - t0}ms:`, error instanceof Error ? error.message : error);
    writer.write({
      type: "data-generationError",
      id: `error:${turnId}`,
      data: { title: "Internship update failed", message: "We couldn't prepare that internship update. Nothing was changed." },
    });
    return;
  }

  const changes = describeOpportunityEdit(patch, current);
  if (changes.length === 0) {
    writePlainText(writer, `intro:${turnId}`, "I couldn't identify a specific posting field to change. Tell me the new value, or open the internship editor.");
    return;
  }

  writer.write({
    type: "data-internshipEditProposal",
    id: `internshipEdit:${turnId}`,
    data: { opportunityId, role: opportunity.role, revisionInstruction, patch, changes },
  });
  writePlainText(writer, `intro:${turnId}`, "Review the proposed internship update before applying it.");
}

async function applyExistingInternshipEdit(
  writer: UIMessageStreamWriter<AssistantUIMessage>,
  params: {
    requestId: string;
    t0: number;
    turnId: string;
    companyId: string;
    opportunityId: string;
    revisionInstruction: string;
    patch: OpportunityEditPatch;
  },
) {
  const { requestId, t0, turnId, companyId, opportunityId, revisionInstruction } = params;
  const patch = OpportunityEditPatchSchema.parse(params.patch);
  if (opportunityEditEntries(patch).length === 0) {
    writer.write({
      type: "data-generationError",
      id: `error:${turnId}`,
      data: { title: "Internship update failed", message: "That update contains no changes." },
    });
    return;
  }

  const db = getDb();
  const [opportunity] = await db.select().from(schema.opportunities).where(eq(schema.opportunities.id, opportunityId)).limit(1);
  if (!opportunity || opportunity.companyId !== companyId) {
    writer.write({
      type: "data-generationError",
      id: `error:${turnId}`,
      data: { title: "Internship update failed", message: "That internship couldn't be found." },
    });
    return;
  }

  const form: InternshipFormInput = {
    role: patch.role ?? opportunity.role,
    department: patch.department ?? opportunity.department,
    shortDescription: patch.shortDescription ?? opportunity.shortDescription,
    description: patch.description ?? opportunity.description,
    whatYouWillLearn: patch.whatYouWillLearn ?? opportunity.whatYouWillLearn,
    requirements: patch.requirements ?? opportunity.requirements,
    niceToHave: patch.niceToHave ?? opportunity.niceToHave,
    duration: patch.duration ?? opportunity.duration,
    hoursPerWeek: patch.hoursPerWeek ?? opportunity.hoursPerWeek,
    location: patch.location ?? opportunity.location,
    workMode: patch.workMode ?? opportunity.workMode,
    applicationDeadline: patch.applicationDeadline ? dateFromInput(patch.applicationDeadline) : opportunity.applicationDeadline,
    startDate: patch.startDate ? dateFromInput(patch.startDate) : opportunity.startDate,
    slots: patch.slots ?? opportunity.slots,
    skills: patch.skills ?? opportunity.skills,
    requireCv: patch.requireCv ?? opportunity.requireCv,
    applicationQuestions: patch.applicationQuestions ?? opportunity.applicationQuestions,
  };

  try {
    await saveInternshipAction({ opportunityId, publish: opportunity.status === "published", form });
    console.log(`[assistant] requestId=${requestId} internship edit applied at +${Date.now() - t0}ms opportunityId=${opportunityId}`);
    writePlainText(writer, `intro:${turnId}`, `Updated ${form.role}. The change is saved to the existing internship.`);
  } catch (error) {
    console.error(`[assistant] requestId=${requestId} internship edit apply failed at +${Date.now() - t0}ms instruction=${revisionInstruction}:`, error instanceof Error ? error.message : error);
    writer.write({
      type: "data-generationError",
      id: `error:${turnId}`,
      data: { title: "Internship update failed", message: "We couldn't save that internship update. Nothing was changed." },
    });
  }
}

type OpportunityRow = typeof schema.opportunities.$inferSelect;

function dateInputValue(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function dateFromInput(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

function opportunitySnapshot(opportunity: OpportunityRow): Record<string, unknown> {
  return {
    role: opportunity.role,
    department: opportunity.department,
    shortDescription: opportunity.shortDescription,
    description: opportunity.description,
    whatYouWillLearn: opportunity.whatYouWillLearn,
    requirements: opportunity.requirements,
    niceToHave: opportunity.niceToHave,
    duration: opportunity.duration,
    hoursPerWeek: opportunity.hoursPerWeek,
    location: opportunity.location,
    workMode: opportunity.workMode,
    applicationDeadline: dateInputValue(opportunity.applicationDeadline),
    startDate: dateInputValue(opportunity.startDate),
    slots: opportunity.slots,
    skills: opportunity.skills,
    requireCv: opportunity.requireCv,
    applicationQuestions: opportunity.applicationQuestions,
  };
}
