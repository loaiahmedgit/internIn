"use client";

import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { updateChallengeCredentialPolicyAction } from "@/lib/opportunities/actions";

type CredentialPolicy = "off" | "internin_verified" | "company_endorsed";

const POLICY_OPTIONS: { value: CredentialPolicy; title: string; description: string }[] = [
  { value: "off", title: "No credential", description: "Students complete the challenge without earning a reusable credential." },
  { value: "internin_verified", title: "internIn Verified", description: "Qualifying work can earn a verified credential based on challenge evidence." },
  { value: "company_endorsed", title: "Company Endorsed", description: "Qualifying credentials also carry your company's endorsement." },
];

/**
 * Compact per-challenge credential policy — Phase 4C §2/§3/§4. The 70%
 * evidence-coverage rule stays internal; nothing here exposes it.
 */
export function ChallengeCredentialSettings({
  opportunityId,
  initial,
}: {
  opportunityId: string;
  initial: { credentialPolicy: CredentialPolicy; requireHumanConfirmation: boolean; showCompanyLogo: boolean };
}) {
  const [policy, setPolicy] = useState<CredentialPolicy>(initial.credentialPolicy);
  const [requireConfirmation, setRequireConfirmation] = useState(initial.requireHumanConfirmation);
  const [showLogo, setShowLogo] = useState(initial.showCompanyLogo);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  function save() {
    startTransition(async () => {
      try {
        await updateChallengeCredentialPolicyAction({ opportunityId, credentialPolicy: policy, requireHumanConfirmation: requireConfirmation, showCompanyLogo: showLogo });
        setMessage({ text: "Saved." });
      } catch (error) {
        setMessage({ text: error instanceof Error ? error.message : "Couldn't save.", error: true });
      }
    });
  }

  return (
    <section className="rounded-xl border border-navy/10 bg-white p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-teal-ink" aria-hidden="true" />
        <h2 className="text-base font-semibold text-navy">Challenge credential</h2>
      </div>
      <div className="mt-4 space-y-2">
        {POLICY_OPTIONS.map((option) => (
          <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${policy === option.value ? "border-teal/40 bg-teal/5" : "border-navy/10"}`}>
            <input type="radio" name="credentialPolicy" value={option.value} checked={policy === option.value} onChange={() => setPolicy(option.value)} className="mt-1 size-4 shrink-0 accent-teal-ink" />
            <span>
              <span className="block text-sm font-medium text-navy">{option.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-navy/60">{option.description}</span>
            </span>
          </label>
        ))}
      </div>

      {policy !== "off" && (
        <label className="mt-4 flex cursor-pointer items-start gap-3 border-t border-navy/8 pt-4">
          <input type="checkbox" checked={requireConfirmation} onChange={(e) => setRequireConfirmation(e.target.checked)} className="mt-1 size-4 shrink-0 accent-teal-ink" />
          <span>
            <span className="block text-sm font-medium text-navy">Require reviewer confirmation before issuance</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-navy/60">If enabled, qualifying work waits for an authorized reviewer before the credential is issued. This is not a hiring decision.</span>
          </span>
        </label>
      )}

      {policy === "company_endorsed" && (
        <label className="mt-4 flex cursor-pointer items-start gap-3 border-t border-navy/8 pt-4">
          <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} className="mt-1 size-4 shrink-0 accent-teal-ink" />
          <span>
            <span className="block text-sm font-medium text-navy">Allow your company logo on the credential</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-navy/60">Only shown on credentials your company explicitly endorses — never on an internIn Verified-only credential.</span>
          </span>
        </label>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-teal-ink px-4 text-sm font-medium text-white transition-colors hover:bg-teal-ink/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {message && <p role={message.error ? "alert" : "status"} className={`text-sm ${message.error ? "text-red-700" : "text-teal-ink"}`}>{message.text}</p>}
      </div>
    </section>
  );
}
