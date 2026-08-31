"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Paperclip, Copy, RotateCcw, Users, FileText, PenSquare, BarChart3, Briefcase } from "lucide-react";

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
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion";
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

  const composer = (
    <div ref={composerRef}>
      <PromptInput onSubmit={handleSubmit} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*" multiple maxFiles={5} globalDrop>
        <PromptInputBody>
          <PromptInputTextarea placeholder="Ask about your hiring, internships, candidates, or pipeline..." />
        </PromptInputBody>
        <ComposerAttachments />
        <PromptInputFooter>
          <PromptInputTools>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger tooltip="Attach">
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
            {speechSupported && (
              <SpeechInput className="size-8" onTranscriptionChange={handleTranscript} />
            )}
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputTools>
        </PromptInputFooter>
      </PromptInput>
    </div>
  );

  const suggestionRow = (
    <Suggestions>
      {suggestions.map((s) => (
        <Suggestion key={s} suggestion={s} onClick={(text) => sendMessage({ text })} />
      ))}
    </Suggestions>
  );

  if (!hasMessages) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col px-6 py-16">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-navy">Ask internIn</h1>
          <p className="mt-2 text-sm text-navy/55">Your hiring assistant for internships, candidates and pipeline insights.</p>
        </div>
        <div className="mt-8">{composer}</div>
        <div className="mt-3">{suggestionRow}</div>
        {error && <p className="mt-4 text-center text-sm text-destructive">{error.message}</p>}
        <p className="mt-10 text-center text-[11px] text-navy/40">Assistive only — you make every hiring decision.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-13rem)] min-h-[28rem] max-w-3xl flex-col px-6 py-6">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.map((message) => {
            const steps = message.parts.filter((p): p is Extract<typeof p, { type: "data-step" }> => p.type === "data-step");
            const textParts = message.parts.filter((p) => p.type === "text");
            const responseText = textParts.map((p) => p.text).join("");
            const isLastAssistant = message.role === "assistant" && message.id === messages.at(-1)?.id;

            return (
              <Message key={message.id} from={message.role}>
                {message.role === "user" ? (
                  <MessageContent>{responseText}</MessageContent>
                ) : (
                  <MessageContent>
                    {steps.length > 0 && (
                      <ChainOfThought defaultOpen={false}>
                        <ChainOfThoughtHeader />
                        <ChainOfThoughtContent>
                          {steps.map((step) => {
                            const data = step.data as AssistantStepData;
                            return (
                              <ChainOfThoughtStep
                                key={step.id}
                                label={data.label}
                                description={data.description}
                                status={data.status}
                              />
                            );
                          })}
                        </ChainOfThoughtContent>
                      </ChainOfThought>
                    )}
                    {responseText ? (
                      <div className="typeset typeset-docs max-w-none">
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
                      </>
                    )}
                  </MessageContent>
                )}
              </Message>
            );
          })}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error && <p className="mb-2 text-center text-sm text-destructive">{error.message}</p>}

      <div className="sticky bottom-0 border-t border-navy/10 bg-white pt-3">
        {composer}
        <div className="mt-3">{suggestionRow}</div>
      </div>
    </div>
  );
}
