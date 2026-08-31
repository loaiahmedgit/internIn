"use client";

import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Paperclip, Copy, RotateCcw, Users, FileText, PenSquare, BarChart3, Briefcase } from "lucide-react";

import { CompanyPageContainer } from "@/components/company/page-shell";
import { SelectGroup } from "@/components/ui/select";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  PromptInputSelect,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSubmit,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Attachments, Attachment, AttachmentPreview, AttachmentInfo, AttachmentRemove } from "@/components/ai-elements/attachments";
import { Suggestion } from "@/components/ai-elements/suggestion";
import { SpeechInput } from "@/components/ai-elements/speech-input";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse, MessageActions, MessageAction } from "@/components/ai-elements/message";
import { ChainOfThought, ChainOfThoughtHeader, ChainOfThoughtContent, ChainOfThoughtStep } from "@/components/ai-elements/chain-of-thought";
import { Shimmer } from "@/components/ai-elements/shimmer";
import type { AssistantStepData, AssistantUIMessage } from "@/lib/ai/assistant-messages";

const ALL_HIRING_SUGGESTIONS = [
  "What needs my attention?",
  "Summarize this week's hiring",
  "Which internships are closing soon?",
  "Show applications waiting for review",
  "Compare applicant volume",
  "How is offer acceptance trending?",
];

const PER_INTERNSHIP_SUGGESTIONS = [
  "Summarize this pipeline",
  "What needs review?",
  "Which requirements are applicants missing?",
  "Show recent activity",
  "How many candidates reached shortlist?",
  "Should we improve the listing?",
];

type ActionLink = { label: string; href: string; icon: typeof Users };

function actionsFor(text: string, opportunityId: string | null): ActionLink[] {
  const lower = text.toLowerCase();
  const links: ActionLink[] = [];
  const candidatesHref = opportunityId ? `/company/candidates?opportunity=${opportunityId}` : "/company/candidates";
  if (lower.includes("review") || lower.includes("candidate") || lower.includes("applicant") || lower.includes("shortlist") || lower.includes("hire")) {
    links.push({ label: "View candidates", href: candidatesHref, icon: Users });
  }
  if (opportunityId && (lower.includes("challenge") || lower.includes("task") || lower.includes("deliverable"))) {
    links.push({ label: "View challenge", href: `/company/opportunities/${opportunityId}?tab=challenge`, icon: FileText });
  }
  if (opportunityId && (lower.includes("requirement") || lower.includes("description") || lower.includes("listing"))) {
    links.push({ label: "Edit listing", href: `/company/opportunities/${opportunityId}/edit`, icon: PenSquare });
  }
  if (!opportunityId && (lower.includes("internship") || lower.includes("closing") || lower.includes("deadline"))) {
    links.push({ label: "View internships", href: "/company/internships", icon: Briefcase });
  }
  if (lower.includes("trend") || lower.includes("conversion") || lower.includes("performance") || lower.includes("activity") || lower.includes("acceptance")) {
    links.push({ label: "View analytics", href: opportunityId ? `/company/analytics?opportunity=${opportunityId}` : "/company/analytics", icon: BarChart3 });
  }
  return links.slice(0, 2);
}

const speechSupportSubscribe = () => () => {};
const getServerSpeechSupport = () => false;
const getClientSpeechSupport = () => "SpeechRecognition" in window || "webkitSpeechRecognition" in window;

/** Real browser feature check — the mic button only renders when the
 * browser actually supports it, never a disabled decoration. Uses
 * useSyncExternalStore (not an effect) so there's no server/client
 * hydration mismatch: SSR and the first client render both see "false",
 * then React re-syncs to the real client snapshot right after. */
function useSpeechSupported() {
  return useSyncExternalStore(speechSupportSubscribe, getClientSpeechSupport, getServerSpeechSupport);
}

function ComposerAttachments() {
  const { files, remove } = usePromptInputAttachments();
  if (files.length === 0) return null;
  return (
    <Attachments variant="inline" className="px-3 pt-3">
      {files.map((file) => (
        <Attachment key={file.id} data={file} onRemove={() => remove(file.id)}>
          <AttachmentPreview />
          <AttachmentInfo />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  );
}

export function AssistantWorkspace({
  opportunityOptions,
  opportunityId,
}: {
  opportunityOptions: { value: string; label: string }[];
  opportunityId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const composerRef = useRef<HTMLDivElement>(null);
  const speechSupported = useSpeechSupported();

  const { messages, sendMessage, status, regenerate, stop, error, clearError } = useChat<AssistantUIMessage>({
    transport: new DefaultChatTransport({ api: "/api/assistant", body: { opportunityId } }),
  });

  const handleScopeChange = useCallback(
    (next: unknown) => {
      if (typeof next !== "string") return;
      const params = new URLSearchParams(searchParams.toString());
      if (next === "all") params.delete("opportunity");
      else params.set("opportunity", next);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      if (!message.text.trim() && message.files.length === 0) return;
      clearError();
      sendMessage({ text: message.text, files: message.files });
    },
    [sendMessage, clearError],
  );

  const handleTranscript = useCallback((transcript: string) => {
    const textarea = composerRef.current?.querySelector<HTMLTextAreaElement>('textarea[name="message"]');
    if (!textarea) return;
    textarea.value = textarea.value ? `${textarea.value} ${transcript}` : transcript;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
  }, []);

  const suggestions = opportunityId ? PER_INTERNSHIP_SUGGESTIONS : ALL_HIRING_SUGGESTIONS;
  const hasMessages = messages.length > 0;
  const isStreaming = status === "submitted" || status === "streaming";

  // Contextual follow-ups after the conversation starts: reuse the same
  // scope's canned suggestion pool, just drop whatever's already been
  // asked and cap it small — never a fabricated "generated from your
  // answer" claim, just a short, honest list of relevant next questions.
  const askedTexts = useMemo(
    () =>
      new Set(
        messages
          .filter((m) => m.role === "user")
          .flatMap((m) => m.parts.filter((p) => p.type === "text").map((p) => p.text.trim())),
      ),
    [messages],
  );
  const followups = suggestions.filter((s) => !askedTexts.has(s)).slice(0, 3);

  /** The composer toolbar is identical in both states (attach + scope on
   * the left, mic + submit on the right) — only the textarea's height
   * differs: roomy for the empty-state hero, compact once a real
   * conversation is underway (a ChatGPT/Claude-style persistent bar, not
   * a form textarea). */
  function renderComposer(compact: boolean) {
    return (
      <div ref={composerRef}>
        <PromptInput onSubmit={handleSubmit} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*" multiple maxFiles={5} globalDrop>
          <PromptInputBody>
            <PromptInputTextarea
              placeholder="Ask about your hiring, internships, candidates, or pipeline..."
              className={compact ? "min-h-10 max-h-40" : undefined}
            />
          </PromptInputBody>
          <ComposerAttachments />
          <PromptInputFooter>
            <PromptInputTools>
              {/* No `tooltip` prop here: PromptInputButton's tooltip wraps its
                  output in a Tooltip/TooltipTrigger, which is itself a real
                  <button> — nesting that inside DropdownMenuTrigger's `render`
                  merge produces an invalid <button> inside <button> and a
                  hydration mismatch. aria-label covers accessibility instead. */}
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger aria-label="Attach files">
                  <Paperclip className="size-4" />
                </PromptInputActionMenuTrigger>
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                  <PromptInputActionAddScreenshot />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              <PromptInputSelect value={opportunityId ?? "all"} onValueChange={handleScopeChange}>
                <PromptInputSelectTrigger className="w-auto max-w-40" aria-label="Ask about">
                  <PromptInputSelectValue className="min-w-0 truncate">
                    {(value: string) => opportunityOptions.find((o) => o.value === value)?.label ?? value}
                  </PromptInputSelectValue>
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  <SelectGroup>
                    {opportunityOptions.map((o) => (
                      <PromptInputSelectItem key={o.value} value={o.value}>
                        {o.label}
                      </PromptInputSelectItem>
                    ))}
                  </SelectGroup>
                </PromptInputSelectContent>
              </PromptInputSelect>
            </PromptInputTools>
            <PromptInputTools>
              {speechSupported && <SpeechInput className="size-8" onTranscriptionChange={handleTranscript} />}
              <PromptInputSubmit status={status} onStop={stop} />
            </PromptInputTools>
          </PromptInputFooter>
        </PromptInput>
      </div>
    );
  }

  if (!hasMessages) {
    return (
      <CompanyPageContainer>
        {/* max-w-3xl inside CompanyPageContainer's own wide canvas: the
            composer reads as a deliberately-composed centerpiece (~60-70%
            of the available content width on a large desktop), not a
            component stretched edge-to-edge and not the old 672px box
            floating in unused margins. */}
        <div className="mx-auto flex max-w-3xl flex-col pt-12 pb-16 md:pt-16">
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-navy">Ask internIn</h1>
            <p className="mt-2 text-sm text-navy/55">Your hiring assistant for internships, candidates and pipeline insights.</p>
          </div>
          <div className="mt-8">{renderComposer(false)}</div>
          {/* Suggestion is reused as-is; the Suggestions wrapper hardcodes a
              horizontal-scroll ScrollArea with no wrap option, which is
              exactly the clipping this layout can't have. */}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {suggestions.map((s) => (
              <Suggestion key={s} suggestion={s} onClick={(text) => sendMessage({ text })} />
            ))}
          </div>
          {error && <p className="mt-4 text-center text-sm text-destructive">{error.message}</p>}
          <p className="mt-10 text-center text-[11px] text-navy/40">Assistive only — you make every hiring decision.</p>
        </div>
      </CompanyPageContainer>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Three independent layers, not one flex column doing double duty:
          Conversation is the ONE scrolling region (fills whatever height is
          left); the message column inside it is top-anchored, normal
          document flow — messages start right after the top padding, not
          bottom-pinned. The composer below is a separate, independently
          positioned layer with its own margin from the viewport edge. No
          justify-end/justify-between anywhere in this structure. */}
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-6xl px-6 pt-12 pb-8 sm:px-10 lg:px-12">
          {/* The wide max-w-6xl above is the canvas ceiling for a future
              rich/wide result component to render as a sibling of this
              column. Ordinary messages — including the user bubble — live
              in this narrower, centered reading column so the user message
              aligns to the conversation's own right edge, not the
              dashboard's. */}
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
            {messages.map((message) => {
            const steps = message.parts.filter((p): p is Extract<typeof p, { type: "data-step" }> => p.type === "data-step");
            const textParts = message.parts.filter((p) => p.type === "text");
            const responseText = textParts.map((p) => p.text).join("");
            const isLastAssistant = message.role === "assistant" && message.id === messages.at(-1)?.id;
            const isGrounded = steps.length > 0;

            return (
              <Message key={message.id} from={message.role}>
                {message.role === "user" ? (
                  <MessageContent>{responseText}</MessageContent>
                ) : (
                  <MessageContent className="w-full max-w-none">
                    {isGrounded && (
                      <ChainOfThought defaultOpen={false}>
                        <ChainOfThoughtHeader>How I checked this</ChainOfThoughtHeader>
                        <ChainOfThoughtContent>
                          {steps.map((step) => {
                            const data = step.data as AssistantStepData;
                            return (
                              <ChainOfThoughtStep key={step.id} label={data.label} description={data.description} status={data.status} />
                            );
                          })}
                        </ChainOfThoughtContent>
                      </ChainOfThought>
                    )}
                    {responseText ? (
                      <div className="typeset typeset-docs">
                        <MessageResponse>{responseText}</MessageResponse>
                      </div>
                    ) : (
                      isLastAssistant && isStreaming && <Shimmer>Thinking…</Shimmer>
                    )}
                    {responseText && (
                      <>
                        <MessageActions>
                          <MessageAction tooltip="Copy" onClick={() => navigator.clipboard.writeText(responseText)}>
                            <Copy className="size-3.5" />
                          </MessageAction>
                          {isLastAssistant && (
                            <MessageAction tooltip="Retry" onClick={() => regenerate()}>
                              <RotateCcw className="size-3.5" />
                            </MessageAction>
                          )}
                        </MessageActions>
                        <div className="flex flex-wrap gap-3">
                          {actionsFor(responseText, opportunityId).map((a) => (
                            <Link key={a.label} href={a.href} className="flex items-center gap-1 text-xs font-medium text-teal-ink hover:underline">
                              <a.icon className="size-3" aria-hidden="true" />
                              {a.label}
                            </Link>
                          ))}
                        </div>
                        {isLastAssistant && isGrounded && !isStreaming && followups.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {followups.map((s) => (
                              <Suggestion key={s} suggestion={s} onClick={(text) => sendMessage({ text })} />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </MessageContent>
                )}
              </Message>
            );
            })}
          </div>
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Independent bottom layer, not glued to the viewport edge: a subtle
          fade (not a border, not a shadow bar) softens the handoff from
          scrolled content, and pb-8 gives the composer real breathing room
          above the edge instead of sitting flush against it. Narrowed to
          max-w-3xl — the same width as the reading column above, not the
          wider canvas ceiling. */}
      <div className="relative z-10 shrink-0 px-6 pt-4 pb-8 sm:px-10 lg:px-12">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-white to-transparent" />
        <div className="relative mx-auto w-full max-w-3xl">
          {error && <p className="mb-2 text-center text-sm text-destructive">{error.message}</p>}
          {renderComposer(true)}
        </div>
      </div>
    </div>
  );
}
