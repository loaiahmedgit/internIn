"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, FileCheck2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ActionOfferData, InternshipChoiceData, InternshipCreatedData, InternshipEditProposalData } from "@/lib/ai/assistant-messages";

type ActionOfferChoice = "create_internship_draft" | "create_challenge_only";

export function AssistantActionOfferCard({
  data,
  selected,
  disabled,
  onChoose,
}: {
  data: ActionOfferData;
  selected: ActionOfferChoice | null;
  disabled: boolean;
  onChoose: (choice: ActionOfferChoice) => void;
}) {
  // A click is transient workflow state, not a durable transcript event.
  // The next assistant message owns the real pending indicator and then
  // replaces it with the completed internship card.
  if (selected === "create_internship_draft") return null;

  if (selected) {
    return <CompletedAction label="Challenge draft requested" />;
  }

  return (
    <Card size="sm" className="not-typeset mt-4 border-border bg-card shadow-none">
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BriefcaseBusiness className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Ready to create the hiring setup</p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{data.roleSummary}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pl-11">
          <Button type="button" onClick={() => onChoose("create_internship_draft")} disabled={disabled}>
            Create internship draft
          </Button>
          <Button type="button" variant="outline" onClick={() => onChoose("create_challenge_only")} disabled={disabled}>
            Create challenge only
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AssistantInternshipChoiceCard({
  data,
  selectedOpportunityId,
  disabled,
  onChoose,
}: {
  data: InternshipChoiceData;
  selectedOpportunityId: string | null;
  disabled: boolean;
  onChoose: (opportunityId: string, role: string) => void;
}) {
  if (selectedOpportunityId) {
    const selected = data.options.find((option) => option.id === selectedOpportunityId);
    return <CompletedAction label={selected ? `${selected.role} selected` : "Internship selected"} />;
  }

  if (data.options.length === 0) return null;

  return (
    <Card size="sm" className="not-typeset mt-4 border-border bg-card shadow-none">
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-medium text-foreground">Choose the internship to update</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Only internships in this workspace are shown.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {data.options.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant="outline"
              className="h-auto min-w-0 justify-start px-3 py-2 text-left whitespace-normal"
              onClick={() => onChoose(option.id, option.role)}
              disabled={disabled}
            >
              <BriefcaseBusiness className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{option.role}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AssistantInternshipCreatedCard({ data }: { data: InternshipCreatedData }) {
  return (
    <Card size="sm" className="not-typeset mt-4 border-border bg-card shadow-none">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center text-primary">
            <FileCheck2 className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Internship draft created</p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{data.role}</p>
          </div>
        </div>
        <Link
          href={`/company/opportunities/${data.opportunityId}/setup`}
          className={cn(buttonVariants({ size: "sm" }), "w-full shrink-0 sm:w-auto")}
        >
          Review internship draft
        </Link>
      </CardContent>
    </Card>
  );
}

export function AssistantInternshipEditProposalCard({
  data,
  confirmed,
  disabled,
  onConfirm,
}: {
  data: InternshipEditProposalData;
  confirmed: boolean;
  disabled: boolean;
  onConfirm: () => void;
}) {
  if (confirmed) return <CompletedAction label="Internship update confirmed" />;

  return (
    <Card size="sm" className="not-typeset mt-4 border-border bg-card shadow-none">
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-medium text-foreground">Review changes to {data.role}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Nothing changes until you confirm.</p>
        </div>
        <dl className="space-y-2 rounded-lg bg-muted/40 p-3">
          {data.changes.map((change) => (
            <div key={change.label} className="grid gap-1 text-sm sm:grid-cols-[140px_1fr]">
              <dt className="font-medium text-foreground">{change.label}</dt>
              <dd className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-muted-foreground">
                <span className="line-clamp-2 break-words line-through opacity-70" title={change.before}>{change.before}</span>
                <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="line-clamp-2 min-w-0 break-words text-foreground" title={change.after}>{change.after}</span>
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onConfirm} disabled={disabled}>Confirm update</Button>
          <Link href={`/company/opportunities/${data.opportunityId}/edit`} className={buttonVariants({ variant: "outline" })}>
            Edit manually
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function CompletedAction({ label }: { label: string }) {
  return (
    <div className="not-typeset mt-3 flex w-fit items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
      <CheckCircle2 className="size-3.5 text-primary" aria-hidden="true" />
      {label}
    </div>
  );
}
