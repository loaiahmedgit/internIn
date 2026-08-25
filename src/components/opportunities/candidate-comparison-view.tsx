"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { compareCandidateSubmissionsAction } from "@/lib/opportunities/evidence-actions";
import { shortlistApplicationAction } from "@/lib/opportunities/actions";
import { InviteToInternshipButton } from "@/components/opportunities/invite-to-internship-button";
import type { CandidateComparisonRow } from "@/lib/ai";

type Candidate = {
  applicationId: string;
  applicationStatus: string;
  studentName: string;
  submissionId: string;
  alreadyInvited: boolean;
};

export function CandidateComparisonView({ candidates }: { candidates: Candidate[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<CandidateComparisonRow[] | null>(null);
  const [shortlisted, setShortlisted] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [shortlistingId, setShortlistingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byName = new Map(candidates.map((c) => [c.studentName, c]));

  function toggle(submissionId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(submissionId)) next.delete(submissionId);
      else next.add(submissionId);
      return next;
    });
  }

  function handleCompare() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await compareCandidateSubmissionsAction(Array.from(selected));
        setRows(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't compare candidates. Try again.");
      }
    });
  }

  function handleShortlist(applicationId: string) {
    setShortlistingId(applicationId);
    startTransition(async () => {
      try {
        await shortlistApplicationAction(applicationId);
        setShortlisted((prev) => new Set(prev).add(applicationId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't shortlist. Try again.");
      } finally {
        setShortlistingId(null);
      }
    });
  }

  return (
    <div className="mt-8">
      <div className="space-y-2">
        {candidates.map((c) => (
          <label
            key={c.submissionId}
            className="flex items-center gap-3 rounded-lg border border-gray-cool/60 bg-white p-3"
          >
            <input
              type="checkbox"
              checked={selected.has(c.submissionId)}
              onChange={() => toggle(c.submissionId)}
              className="size-4"
            />
            <span className="font-medium text-navy">{c.studentName}</span>
            <span className="text-sm capitalize text-navy/50">{c.applicationStatus}</span>
          </label>
        ))}
      </div>

      <Button className="mt-4" disabled={selected.size < 2 || isPending} onClick={handleCompare}>
        {isPending && !shortlistingId ? "Comparing…" : `Compare selected (${selected.size})`}
      </Button>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      {rows && (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-cool/60 text-left text-xs uppercase text-navy/50">
                <th className="py-2 pr-4">Candidate</th>
                <th className="py-2 pr-4">Completion</th>
                <th className="py-2 pr-4">Time</th>
                <th className="py-2 pr-4">Main strength</th>
                <th className="py-2 pr-4">Main weakness</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const candidate = byName.get(row.candidateName);
                const isShortlisted =
                  candidate && (shortlisted.has(candidate.applicationId) || candidate.applicationStatus === "shortlisted");
                return (
                  <tr key={row.candidateName} className="border-b border-gray-cool/30 align-top">
                    <td className="py-3 pr-4 font-medium text-navy">{row.candidateName}</td>
                    <td className="py-3 pr-4 text-navy/80">{row.completion}</td>
                    <td className="py-3 pr-4 text-navy/80">{row.timeMinutes} min</td>
                    <td className="py-3 pr-4 text-navy/80">{row.mainStrength}</td>
                    <td className="py-3 pr-4 text-navy/80">{row.mainWeakness}</td>
                    <td className="py-3 pr-4">
                      {candidate && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isShortlisted || shortlistingId === candidate.applicationId}
                            onClick={() => handleShortlist(candidate.applicationId)}
                          >
                            {isShortlisted ? "Shortlisted" : "Shortlist"}
                          </Button>
                          <InviteToInternshipButton
                            applicationId={candidate.applicationId}
                            candidateName={candidate.studentName}
                            alreadyInvited={candidate.alreadyInvited}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
