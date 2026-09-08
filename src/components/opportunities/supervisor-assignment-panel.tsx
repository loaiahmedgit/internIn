"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  getEligibleProgramSupervisorsAction,
  assignProgramSupervisorAction,
  removeProgramSupervisorAction,
} from "@/lib/opportunities/program-actions";

type Member = { id: string; name: string; email: string; eligible: boolean };
type Assignment = { companyMemberId: string; isPrimary: boolean };

/**
 * Phase 6A §8/§9/§10 — supervisor assignment lives directly on the
 * existing program page, not a new screen. Honest empty state ("Needs
 * supervisor") when nobody's assigned yet — never a fake default
 * assignee. The selector only ever offers real company members who
 * actually hold Program Supervisor access; the server re-validates every
 * choice regardless (this UI is a convenience, not the authorization).
 */
export function SupervisorAssignmentPanel({ programId }: { programId: string }) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [assigned, setAssigned] = useState<Assignment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getEligibleProgramSupervisorsAction(programId)
      .then((result) => {
        if (cancelled) return;
        setMembers(result.members);
        setAssigned(result.assigned);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Couldn't load supervisors.");
      });
    return () => {
      cancelled = true;
    };
  }, [programId]);

  function refresh() {
    getEligibleProgramSupervisorsAction(programId).then((result) => {
      setMembers(result.members);
      setAssigned(result.assigned);
    });
  }

  function handleAssign() {
    if (!selected) return;
    setActionError(null);
    startTransition(async () => {
      try {
        await assignProgramSupervisorAction(programId, selected, assigned.length === 0);
        setSelected("");
        refresh();
        router.refresh();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Couldn't assign that supervisor.");
      }
    });
  }

  function handleRemove(companyMemberId: string) {
    setActionError(null);
    startTransition(async () => {
      try {
        await removeProgramSupervisorAction(programId, companyMemberId);
        refresh();
        router.refresh();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Couldn't remove that supervisor.");
      }
    });
  }

  const memberById = new Map((members ?? []).map((m) => [m.id, m]));
  const eligibleUnassigned = (members ?? []).filter((m) => m.eligible && !assigned.some((a) => a.companyMemberId === m.id));

  return (
    <div className="mt-5 border border-navy/12 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">Supervisor</p>

      {loadError && <p className="mt-2 text-sm text-red-600">{loadError}</p>}

      {members !== null && (
        <>
          {assigned.length === 0 ? (
            <p className="mt-1.5 text-sm text-amber-700">Needs supervisor</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {assigned.map((a) => {
                const m = memberById.get(a.companyMemberId);
                return (
                  <li key={a.companyMemberId} className="flex items-center justify-between text-sm">
                    <span className="text-navy">
                      {m?.name ?? "Unknown member"}
                      {a.isPrimary && <span className="ml-1.5 text-xs text-teal-ink">(Primary)</span>}
                    </span>
                    <Button variant="ghost" size="sm" disabled={pending} onClick={() => handleRemove(a.companyMemberId)}>
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          {eligibleUnassigned.length > 0 ? (
            <div className="mt-3 flex items-center gap-2">
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="h-8 flex-1 rounded-md border border-navy/15 bg-white px-2 text-sm text-navy"
              >
                <option value="">Assign a supervisor…</option>
                {eligibleUnassigned.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>
              <Button size="sm" disabled={!selected || pending} onClick={handleAssign}>
                {pending ? "Assigning…" : "Assign"}
              </Button>
            </div>
          ) : (
            assigned.length === 0 && (
              <p className="mt-2 text-xs text-navy/50">
                No company members have Program Supervisor access yet — grant it in Settings → Team &amp; roles.
              </p>
            )
          )}

          {actionError && <p className="mt-2 text-sm text-red-600">{actionError}</p>}
        </>
      )}
    </div>
  );
}
