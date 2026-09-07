"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ban, BadgeCheck, Clock3, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { confirmChallengeCredentialAction, requestBaseCredentialReviewAction, withdrawCredentialEndorsementAction } from "@/lib/credentials/actions";
import type { CredentialEligibilityState } from "@/lib/credentials/types";

const STATE_LABEL: Record<CredentialEligibilityState, string> = {
  not_eligible: "Not eligible",
  pending_evaluation: "Evaluation pending",
  eligible: "Eligible",
  pending_human_confirmation: "Awaiting confirmation",
  issued: "Issued",
  revoked: "Revoked",
};
const STATE_ICON: Record<CredentialEligibilityState, typeof ShieldCheck> = {
  not_eligible: ShieldQuestion,
  pending_evaluation: Clock3,
  eligible: ShieldCheck,
  pending_human_confirmation: Clock3,
  issued: BadgeCheck,
  revoked: Ban,
};

/**
 * Compact credential state for the reviewer — sits beside the evidence
 * panel, never competes with the hiring decision (Phase 4C §6). The 70%
 * coverage threshold is never shown; only the demonstrated-criteria list
 * (already grounded, non-numeric) appears before a reviewer confirms.
 */
export function CredentialReviewPanel({
  policyOff,
  state,
  companyEndorsed,
  credentialId,
  demonstratedCriteria,
}: {
  policyOff: boolean;
  state: CredentialEligibilityState;
  companyEndorsed: boolean;
  credentialId?: string;
  demonstratedCriteria: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [reportReason, setReportReason] = useState("");

  const label = policyOff ? "Credential unavailable" : state === "issued" && companyEndorsed ? "Issued · Company endorsed" : STATE_LABEL[state];
  const Icon = policyOff ? ShieldQuestion : STATE_ICON[state];

  function run(action: () => Promise<unknown>, onDone: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        onDone();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't complete this action.");
      }
    });
  }

  return (
    <section aria-labelledby="credential-review-heading" className="rounded-xl border border-navy/10 bg-white p-5">
      <h2 id="credential-review-heading" className="text-xs font-semibold tracking-wide text-navy/45 uppercase">
        Challenge credential
      </h2>
      <div className="mt-2.5 flex items-center gap-1.5 text-sm font-medium text-navy">
        <Icon className="size-3.5 shrink-0 text-teal-ink" aria-hidden="true" />
        {label}
      </div>
      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-red-700">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {!policyOff && state === "pending_human_confirmation" && credentialId && (
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger render={<Button size="sm" className="mt-3 bg-teal-ink text-white hover:bg-teal-ink/90" />}>Confirm credential</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm this Verified Challenge Credential?</DialogTitle>
              <DialogDescription>This issues the credential. It does not affect this candidate&apos;s application status or hiring decision.</DialogDescription>
            </DialogHeader>
            {demonstratedCriteria.length > 0 && (
              <div>
                <p className="text-xs font-semibold tracking-wide text-navy/45 uppercase">Demonstrated capabilities</p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {demonstratedCriteria.map((criterion) => (
                    <li key={criterion} className="rounded-full border border-navy/10 bg-[#fafcfc] px-2.5 py-1 text-xs text-navy/72">{criterion}</li>
                  ))}
                </ul>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>Cancel</Button>
              <Button
                onClick={() => run(() => confirmChallengeCredentialAction(credentialId), () => setConfirmOpen(false))}
                disabled={pending}
                className="bg-teal-ink text-white hover:bg-teal-ink/90"
              >
                {pending ? "Confirming…" : "Confirm credential"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {!policyOff && state === "issued" && companyEndorsed && credentialId && (
        <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
          <DialogTrigger render={<Button size="sm" variant="outline" className="mt-3" />}>Withdraw endorsement</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Withdraw your company&apos;s endorsement?</DialogTitle>
              <DialogDescription>The credential itself stays issued and Verified through internIn — only your company&apos;s endorsement is removed. This cannot be undone from here.</DialogDescription>
            </DialogHeader>
            <label className="block text-sm font-medium text-navy">
              Reason (internal)
              <textarea value={withdrawReason} onChange={(e) => setWithdrawReason(e.target.value)} rows={3} className="mt-1.5 w-full rounded-md border border-navy/15 bg-white p-2.5 text-sm text-navy focus-visible:outline-2 focus-visible:outline-teal" />
            </label>
            <DialogFooter>
              <Button variant="outline" onClick={() => setWithdrawOpen(false)} disabled={pending}>Cancel</Button>
              <Button
                onClick={() => run(() => withdrawCredentialEndorsementAction({ credentialId, reason: withdrawReason }), () => setWithdrawOpen(false))}
                disabled={pending || !withdrawReason.trim()}
                className="bg-red-700 text-white hover:bg-red-800"
              >
                {pending ? "Withdrawing…" : "Withdraw endorsement"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Not a revoke — an internIn review signal only. This repo has no
          internIn-admin console yet, so a company can flag a concern but
          cannot itself revoke a base credential (docs/12, Phase 4A §16). */}
      {!policyOff && state === "issued" && credentialId && (
        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogTrigger render={<Button size="sm" variant="outline" className="mt-2 ml-2" />}>Report credential issue</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report an issue with this credential</DialogTitle>
              <DialogDescription>This sends a review request to internIn. It does not revoke the credential — internIn reviews and decides.</DialogDescription>
            </DialogHeader>
            <label className="block text-sm font-medium text-navy">
              What&apos;s the concern?
              <textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} rows={3} className="mt-1.5 w-full rounded-md border border-navy/15 bg-white p-2.5 text-sm text-navy focus-visible:outline-2 focus-visible:outline-teal" />
            </label>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReportOpen(false)} disabled={pending}>Cancel</Button>
              <Button
                onClick={() => run(() => requestBaseCredentialReviewAction({ credentialId, reason: reportReason }), () => setReportOpen(false))}
                disabled={pending || !reportReason.trim()}
                className="bg-teal-ink text-white hover:bg-teal-ink/90"
              >
                {pending ? "Sending…" : "Send to internIn"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
