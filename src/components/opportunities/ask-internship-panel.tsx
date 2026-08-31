"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { askInternshipAssistantAction } from "@/lib/opportunities/actions";
import { Sparkles, Send, Users, FileText, PenSquare, BarChart3 } from "lucide-react";

const SUGGESTED_PROMPTS = [
  "What needs my attention?",
  "Summarize this internship's pipeline.",
  "Which requirements are candidates struggling with?",
  "Why are candidates dropping off?",
  "Summarize recent activity.",
];

type Turn = { question: string; answer: string };

/** Server-side heuristic keeps this deterministic — no extra AI call just to pick which links to show. */
function actionsFor(text: string, opportunityId: string): { label: string; href: string; icon: typeof Users }[] {
  const lower = text.toLowerCase();
  const links: { label: string; href: string; icon: typeof Users }[] = [];
  if (lower.includes("review") || lower.includes("candidate") || lower.includes("applicant") || lower.includes("shortlist") || lower.includes("hire")) {
    links.push({ label: "View candidates", href: `/company/candidates?opportunity=${opportunityId}`, icon: Users });
  }
  if (lower.includes("challenge") || lower.includes("task") || lower.includes("deliverable")) {
    links.push({ label: "View challenge", href: `/company/opportunities/${opportunityId}?tab=challenge`, icon: FileText });
  }
  if (lower.includes("requirement") || lower.includes("description") || lower.includes("listing")) {
    links.push({ label: "Edit listing", href: `/company/opportunities/${opportunityId}/edit`, icon: PenSquare });
  }
  if (lower.includes("trend") || lower.includes("conversion") || lower.includes("performance") || lower.includes("activity")) {
    links.push({ label: "View analytics", href: `/company/analytics?opportunity=${opportunityId}`, icon: BarChart3 });
  }
  return links.slice(0, 2);
}

export function AskInternshipPanel({ opportunityId, role }: { opportunityId: string; role: string }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || isPending) return;
    setError(null);
    setQuestion("");
    startTransition(async () => {
      try {
        const answer = await askInternshipAssistantAction(opportunityId, trimmed);
        setTurns((t) => [...t, { question: trimmed, answer }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't get an answer — try again.");
      }
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Sparkles className="size-3.5 text-teal-ink" />
        Ask internIn
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 border-navy/10 p-0 shadow-lg sm:max-w-md">
          <SheetHeader className="border-b border-navy/10 px-5 py-4">
            <SheetTitle className="flex items-center gap-1.5 text-sm font-semibold text-navy">
              <Sparkles className="size-4 text-teal-ink" />
              Ask internIn
            </SheetTitle>
            <p className="text-xs text-navy/50">Current context: {role}</p>
          </SheetHeader>

          <ScrollArea className="flex-1 px-5 py-4">
            {turns.length === 0 ? (
              <div>
                <p className="text-xs font-medium text-navy/45">Try asking</p>
                <div className="mt-2 space-y-1.5">
                  {SUGGESTED_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => ask(p)}
                      className="block w-full rounded-lg border border-navy/10 px-3 py-2 text-left text-xs text-navy/75 hover:border-teal/30 hover:bg-teal/5 hover:text-navy"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {turns.map((t, i) => (
                  <div key={i} className="space-y-2">
                    <p className="text-sm font-medium text-navy">{t.question}</p>
                    <div className="rounded-lg border border-navy/10 bg-gray-light/60 p-3 text-sm text-navy/80">
                      {t.answer}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {actionsFor(`${t.question} ${t.answer}`, opportunityId).map((a) => (
                        <Link key={a.label} href={a.href} className="flex items-center gap-1 text-xs font-medium text-teal-ink hover:underline">
                          <a.icon className="size-3" />
                          {a.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
                {isPending && <p className="text-xs text-navy/45">Thinking…</p>}
              </div>
            )}
            {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
          </ScrollArea>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(question);
            }}
            className="flex items-center gap-2 border-t border-navy/10 px-4 py-3"
          >
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about this internship…"
              className="h-8"
              disabled={isPending}
            />
            <Button type="submit" size="icon-sm" className="shrink-0 bg-teal text-white hover:bg-teal/90" disabled={isPending || !question.trim()}>
              <Send className="size-3.5" />
            </Button>
          </form>
          <p className="border-t border-navy/8 px-4 py-2 text-center text-[11px] text-navy/40">Assistive only — you make every hiring decision.</p>
        </SheetContent>
      </Sheet>
    </>
  );
}
