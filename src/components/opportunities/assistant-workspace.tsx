"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { QuerySelect } from "@/components/company/query-select";
import { askHiringAssistantAction } from "@/lib/opportunities/actions";
import { Sparkles, Send, Users, FileText, PenSquare, BarChart3, Briefcase } from "lucide-react";

const SUGGESTED_PROMPTS = [
  "What needs my attention?",
  "Summarize this week's hiring.",
  "Which internships are closing soon?",
  "Show offer acceptance over the last month.",
  "Which requirements are applicants commonly missing?",
];

type Turn = { question: string; answer: string };
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

export function AssistantWorkspace({
  opportunityOptions,
  opportunityId,
}: {
  opportunityOptions: { value: string; label: string }[];
  opportunityId: string | null;
}) {
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
        const answer = await askHiringAssistantAction(opportunityId, trimmed);
        setTurns((t) => [...t, { question: trimmed, answer }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't get an answer — try again.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-semibold tracking-tight text-navy">
          <Sparkles className="size-6 text-teal-ink" aria-hidden="true" />
          Ask internIn
        </h1>
        <p className="mt-2 text-sm text-navy/55">Ask about your hiring, internships, candidates, or pipeline.</p>
      </div>

      <div className="mt-8 rounded-2xl border border-navy/10 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-navy/45">Ask about</span>
          <QuerySelect param="opportunity" value={opportunityId ?? "all"} options={opportunityOptions} className="h-7 w-auto border-none bg-transparent px-1.5 text-xs font-medium text-teal-ink shadow-none hover:bg-teal/5" />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="mt-2"
        >
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about your hiring, internships, candidates, or pipeline..."
            className="min-h-20 resize-none border-none bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(question);
              }
            }}
          />
          <div className="mt-2 flex justify-end">
            <Button type="submit" size="sm" className="gap-1.5 bg-teal text-white hover:bg-teal/90" disabled={isPending || !question.trim()}>
              <Send className="size-3.5" aria-hidden="true" />
              {isPending ? "Thinking…" : "Ask"}
            </Button>
          </div>
        </form>
      </div>

      {turns.length === 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => ask(p)}
              className="rounded-full border border-navy/10 bg-white px-3.5 py-1.5 text-xs text-navy/70 hover:border-teal/30 hover:bg-teal/5 hover:text-navy"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}

      {turns.length > 0 && (
        <div className="mt-8 space-y-5">
          {turns.map((t, i) => (
            <div key={i} className="space-y-2">
              <p className="text-sm font-medium text-navy">{t.question}</p>
              <div className="rounded-xl border border-navy/10 bg-white p-4 text-sm text-navy/80">{t.answer}</div>
              <div className="flex flex-wrap gap-3">
                {actionsFor(`${t.question} ${t.answer}`, opportunityId).map((a) => (
                  <Link key={a.label} href={a.href} className="flex items-center gap-1 text-xs font-medium text-teal-ink hover:underline">
                    <a.icon className="size-3" aria-hidden="true" />
                    {a.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {isPending && <p className="text-center text-xs text-navy/45">Thinking…</p>}
        </div>
      )}

      <p className="mt-10 text-center text-[11px] text-navy/40">Assistive only — you make every hiring decision.</p>
    </div>
  );
}
