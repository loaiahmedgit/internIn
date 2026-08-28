import { Badge } from "@/components/ui/badge";
import type { ProgramSeverity } from "@/lib/company/program-progress";

const OPPORTUNITY_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  published: { label: "Published", variant: "default" },
  closed: { label: "Closed", variant: "outline" },
};

export function InternshipStatusBadge({ status }: { status: "draft" | "published" | "closed" }) {
  const { label, variant } = OPPORTUNITY_STATUS[status];
  return <Badge variant={variant}>{label}</Badge>;
}

const CHALLENGE_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Challenge draft", variant: "secondary" },
  ai_generated: { label: "Challenge draft", variant: "secondary" },
  pending_approval: { label: "Pending approval", variant: "secondary" },
  approved: { label: "Approved", variant: "outline" },
  published: { label: "Challenge live", variant: "default" },
  none: { label: "No challenge yet", variant: "secondary" },
};

export function ChallengeStatusBadge({ status }: { status: string }) {
  const entry = CHALLENGE_STATUS[status] ?? CHALLENGE_STATUS.none;
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

const CANDIDATE_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  applied: { label: "Awaiting submission", variant: "secondary" },
  to_review: { label: "Awaiting review", variant: "secondary" },
  shortlisted: { label: "Shortlisted", variant: "default" },
  invited: { label: "Invited", variant: "default" },
  declined: { label: "Passed", variant: "outline" },
  withdrawn: { label: "Withdrawn", variant: "outline" },
};

export type CandidateStatusKey = keyof typeof CANDIDATE_STATUS;

export function CandidateStatusBadge({ status }: { status: CandidateStatusKey }) {
  const { label, variant } = CANDIDATE_STATUS[status];
  return <Badge variant={variant}>{label}</Badge>;
}

const INTERN_SEVERITY: Record<ProgramSeverity, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  not_started: { label: "Not started", variant: "secondary" },
  on_track: { label: "On track", variant: "default" },
  needs_attention: { label: "Needs attention", variant: "secondary" },
  behind_schedule: { label: "Behind schedule", variant: "destructive" },
  completed: { label: "Completed", variant: "outline" },
};

export function InternStatusBadge({ severity }: { severity: ProgramSeverity }) {
  const { label, variant } = INTERN_SEVERITY[severity];
  // "Needs attention" gets its own amber treatment — distinct from both the
  // calm default (on track) and the destructive red (behind schedule).
  if (severity === "needs_attention") {
    return (
      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
        {label}
      </Badge>
    );
  }
  return <Badge variant={variant}>{label}</Badge>;
}
