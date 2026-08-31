import { z } from "zod";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, stepCountIs, streamText, tool } from "ai";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { getModel } from "@/lib/ai/gemma-provider";
import { buildCompanyHiringFacts, buildInternshipFacts } from "@/lib/company/internship-facts";
import type { AssistantUIMessage } from "@/lib/ai/assistant-messages";

export const maxDuration = 60;

const RequestSchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())),
  opportunityId: z.string().uuid().nullable(),
});

/**
 * Streaming backend for "Ask internIn". Whether real workspace data gets
 * queried is a genuine model decision (a real AI SDK tool call), never a
 * server-side keyword guess — a greeting or "what can you do?" should
 * never touch the database, and the fix for that is giving the model the
 * *option* to look things up, not deciding for it. See the tool
 * description below for the actual routing instruction.
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

      const result = streamText({
        model: getModel(),
        system: `You are internIn's hiring assistant, embedded in a company's hiring dashboard. You do not make hiring decisions — you only surface and explain real data when asked, and otherwise just talk normally.

You have one tool, checkWorkspaceData, that looks up real, current facts about ${scopeLabel}. Call it ONLY when the hiring manager's message actually requires real workspace data (applicant counts, stages, deadlines, activity, an internship's status). For a greeting, thanks, small talk, "what can you do?", or a general question about a hiring concept (e.g. "what does shortlisted mean?") or a writing request (e.g. "help me write an internship title"), answer directly and briefly — do NOT call the tool.

When you do call the tool, treat its result as the ONLY source for any number, date, or count in your answer — never invent, estimate, or round a figure it didn't give you. If the result doesn't contain what's needed to answer, say so honestly instead of guessing.

Keep answers short and plain. Use markdown (headings, lists, bold) only when it genuinely helps a data answer's readability — never for a one-line greeting.`,
        messages: await convertToModelMessages(messages),
        tools: { checkWorkspaceData },
        // Default stopWhen is isStepCount(1), which would end the reply
        // right after a tool call with no text — this allows the model to
        // call the tool, see the result, and still write a real answer.
        stopWhen: stepCountIs(4),
      });

      writer.merge(result.toUIMessageStream());
    },
    onError: (error) => (error instanceof Error ? error.message : "Couldn't get an answer — try again."),
  });

  return createUIMessageStreamResponse({ stream });
}
