"use client";

import { useState, useTransition } from "react";
import { UserCog, X } from "lucide-react";
import {
  assignOpportunityResponsibilityAction,
  removeOpportunityResponsibilityAction,
  type OpportunityResponsibilityType,
} from "@/lib/opportunities/responsibility-assignments";

const RESPONSIBILITY_TYPES: { value: OpportunityResponsibilityType; title: string; description: string }[] = [
  { value: "hiring_owner", title: "Hiring owner", description: "Owns the hiring decision for this internship." },
  { value: "challenge_owner", title: "Challenge owner", description: "Owns the challenge content and rubric." },
  { value: "reviewer", title: "Reviewer", description: "Can review candidate evidence and submissions." },
  { value: "certificate_approver", title: "Certificate approver", description: "The only role that can grant a company endorsement — a real human decision, never automatic." },
];

interface Member {
  id: string;
  name: string | null;
  email: string;
}

interface Assignment {
  companyMemberId: string;
  responsibilityType: OpportunityResponsibilityType;
}

/**
 * R1 §4/§5/§6 — pre-hire responsibility on THIS opportunity, never a job
 * title or company-wide role. No self-selected HR/Supervisor identity
 * question — assignment is from real company members only. Deliberately
 * not a new top-level nav item: a compact section inside the existing
 * Challenge tab (opportunities/[id]/page.tsx).
 */
export function OpportunityResponsibilityPanel({
  opportunityId,
  initial,
}: {
  opportunityId: string;
  initial: { members: Member[]; assignments: Assignment[] };
}) {
  const [assignments, setAssignments] = useState<Assignment[]>(initial.assignments);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<Record<OpportunityResponsibilityType, string>>({
    hiring_owner: "",
    challenge_owner: "",
    reviewer: "",
    certificate_approver: "",
  });

  function assignedMembersFor(type: OpportunityResponsibilityType) {
    const ids = new Set(assignments.filter((a) => a.responsibilityType === type).map((a) => a.companyMemberId));
    return initial.members.filter((m) => ids.has(m.id));
  }

  function unassignedMembersFor(type: OpportunityResponsibilityType) {
    const ids = new Set(assignments.filter((a) => a.responsibilityType === type).map((a) => a.companyMemberId));
    return initial.members.filter((m) => !ids.has(m.id));
  }

  function assign(type: OpportunityResponsibilityType) {
    const companyMemberId = selectedMember[type];
    if (!companyMemberId) return;
    setError(null);
    startTransition(async () => {
      try {
        await assignOpportunityResponsibilityAction(opportunityId, companyMemberId, type);
        setAssignments((prev) => [...prev, { companyMemberId, responsibilityType: type }]);
        setSelectedMember((prev) => ({ ...prev, [type]: "" }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't assign this responsibility.");
      }
    });
  }

  function remove(type: OpportunityResponsibilityType, companyMemberId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await removeOpportunityResponsibilityAction(opportunityId, companyMemberId, type);
        setAssignments((prev) => prev.filter((a) => !(a.responsibilityType === type && a.companyMemberId === companyMemberId)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't remove this responsibility.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-navy/10 bg-white p-6">
      <div className="flex items-center gap-2">
        <UserCog className="size-4 text-teal-ink" aria-hidden="true" />
        <h2 className="text-base font-semibold text-navy">People &amp; responsibilities</h2>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-navy/55">Who is responsible for this internship — not a job title, just who owns what here.</p>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}

      <div className="mt-4 space-y-4">
        {RESPONSIBILITY_TYPES.map((type) => {
          const assigned = assignedMembersFor(type.value);
          const unassigned = unassignedMembersFor(type.value);
          return (
            <div key={type.value} className="border-t border-navy/8 pt-4 first:border-t-0 first:pt-0">
              <p className="text-sm font-medium text-navy">{type.title}</p>
              <p className="mt-0.5 text-xs text-navy/55">{type.description}</p>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {assigned.length === 0 && <span className="text-xs text-navy/40">No one assigned yet.</span>}
                {assigned.map((member) => (
                  <span key={member.id} className="inline-flex items-center gap-1 rounded-full border border-navy/12 bg-[#fafcfc] px-2.5 py-1 text-xs text-navy/72">
                    {member.name ?? member.email}
                    <button
                      type="button"
                      onClick={() => remove(type.value, member.id)}
                      disabled={pending}
                      aria-label={`Remove ${member.name ?? member.email} from ${type.title}`}
                      className="ml-0.5 text-navy/40 hover:text-red-700"
                    >
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>

              {unassigned.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <select
                    value={selectedMember[type.value]}
                    onChange={(e) => setSelectedMember((prev) => ({ ...prev, [type.value]: e.target.value }))}
                    className="h-8 rounded-md border border-navy/15 bg-white px-2 text-xs text-navy focus-visible:outline-2 focus-visible:outline-teal"
                  >
                    <option value="">Add a member…</option>
                    {unassigned.map((member) => (
                      <option key={member.id} value={member.id}>{member.name ?? member.email}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => assign(type.value)}
                    disabled={pending || !selectedMember[type.value]}
                    className="inline-flex h-8 items-center justify-center rounded-md bg-teal-ink px-3 text-xs font-medium text-white transition-colors hover:bg-teal-ink/90 disabled:opacity-60"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
