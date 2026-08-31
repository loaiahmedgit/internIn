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
 * Streaming backend for "Ask internIn". Auth-gated the same way as the
 * previous request/response version (askHiringAssistantAction); the only
 * thing that changed is the transport (UI message stream instead of a
 * single generateObject round trip) so the client gets real token
 * streaming plus honest, real progress steps instead of a spinner.
 */
export async function POST(req: Request) {
  const { membership } = await requireCurrentCompanyMember("hiring_reviewer");
  const body = RequestSchema.parse(await req.json());
  const messages = body.messages as unknown as AssistantUIMessage[];
  const opportunityId = body.opportunityId;

  const stream = createUIMessageStream<AssistantUIMessage>({
    execute: async ({ writer }) => {
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
      writer.write({ type: "data-step", id: "generate", data: { label: "Preparing a response", status: "active" } });

      const result = streamText({
        model: getModel(),
        system: `You are an assistive hiring copilot answering questions about the hiring manager's own company data. You do not make hiring decisions — you only surface and explain real data.

Real, already-computed facts (the ONLY things you're allowed to state numbers or dates from — never invent, estimate, or round a figure that isn't here):
"""
${facts}
"""

Answer plainly and concisely, using only the facts above. If the facts don't contain what's needed to answer, say so honestly instead of guessing. You may use short markdown (headings, lists, bold) when it helps readability, but keep answers focused — a few sentences or a short list, not an essay.`,
        messages: await convertToModelMessages(messages),
        onFinish: () => {
          writer.write({ type: "data-step", id: "generate", data: { label: "Prepared a response", status: "complete" } });
        },
      });

      writer.merge(result.toUIMessageStream());
    },
    onError: (error) => (error instanceof Error ? error.message : "Couldn't get an answer — try again."),
  });

  return createUIMessageStreamResponse({ stream });
}
