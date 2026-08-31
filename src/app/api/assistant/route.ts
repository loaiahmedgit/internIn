import { z } from "zod";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, streamText } from "ai";
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
 * A short greeting/small-talk message has nothing to check — there's no
 * real hiring data to load, so no data-step / "how I checked this"
 * disclosure should render for it (never show tool-progress UI above a
 * plain "hi"). Deliberately conservative: only skips the facts+steps path
 * for genuinely trivial messages, never for anything that could contain a
 * real question.
 */
function isSmallTalk(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 40) return false;
  return /^(hi|hey|hello|hiya|yo|sup|howdy|hola|good\s?(morning|afternoon|evening)|thanks|thank you|thx|ok|okay|cool|nice|great|got it|sounds good|bye|goodbye|see ya)[\s!.,]*$/i.test(
    trimmed,
  );
}

/**
 * Streaming backend for "Ask internIn". Auth-gated the same way as the
 * previous request/response version (askHiringAssistantAction); the only
 * thing that changed is the transport (UI message stream instead of a
 * single generateObject round trip) so the client gets real token
 * streaming plus honest, real progress steps instead of a spinner.
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

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const lastUserText = (lastUserMessage?.parts ?? [])
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join(" ");
  const smallTalk = isSmallTalk(lastUserText);

  const stream = createUIMessageStream<AssistantUIMessage>({
    execute: async ({ writer }) => {
      let system: string;

      if (smallTalk) {
        // Nothing to check for a greeting — no data-step part is written at
        // all, so the client renders no "how I checked this" disclosure.
        system =
          "You are internIn's hiring assistant, embedded in a company's hiring dashboard. The hiring manager just sent a short greeting or pleasantry with no real question in it. Reply naturally and briefly — one short sentence is plenty. Do not mention checking data, internships, or candidates; there is nothing to check here.";
      } else {
        const scopeLabel = opportunityId ? "this internship's pipeline" : "your hiring workspace";
        writer.write({ type: "data-step", id: "load", data: { label: `Checking ${scopeLabel}`, status: "active" } });

        const facts = opportunityId
          ? await buildInternshipFacts(opportunityId, membership.companyId)
          : await buildCompanyHiringFacts(membership.companyId);

        writer.write({
          type: "data-step",
          id: "load",
          data: { label: `Checked ${scopeLabel}`, description: facts.split("\n")[0], status: "complete" },
        });

        system = `You are an assistive hiring copilot answering questions about the hiring manager's own company data. You do not make hiring decisions — you only surface and explain real data.

Real, already-computed facts (the ONLY things you're allowed to state numbers or dates from — never invent, estimate, or round a figure that isn't here):
"""
${facts}
"""

Answer plainly and concisely, using only the facts above. If the facts don't contain what's needed to answer, say so honestly instead of guessing. You may use short markdown (headings, lists, bold) when it helps readability, but keep answers focused — a few sentences or a short list, not an essay.`;
      }

      const result = streamText({
        model: getModel(),
        system,
        messages: await convertToModelMessages(messages),
      });

      // sendStart: false only when a data-step write already happened above
      // (that write implicitly starts the message on this stream) — merging
      // a second 'start' event there would make the client treat the reply
      // as a second, separate assistant message. For small talk, nothing
      // was written yet, so the merged stream's own start must go through
      // or no message gets created at all.
      writer.merge(result.toUIMessageStream({ sendStart: smallTalk }));
    },
    onError: (error) => (error instanceof Error ? error.message : "Couldn't get an answer — try again."),
  });

  return createUIMessageStreamResponse({ stream });
}
