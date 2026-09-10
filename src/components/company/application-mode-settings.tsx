"use client";

import { useState, useTransition } from "react";
import { ClipboardCheck } from "lucide-react";
import { updateApplicationModeAction } from "@/lib/opportunities/actions";
import { APPLICATION_MODE_LABEL, APPLICATION_MODE_COMPANY_DESCRIPTION, type ApplicationMode } from "@/lib/opportunities/application-mode";

const APPLICATION_MODE_OPTIONS: ApplicationMode[] = ["quick_apply", "optional_challenge", "challenge_required"];

/**
 * R2 §5/§7 — the one canonical place to change an already-created
 * opportunity's application mode, reused regardless of which flow created
 * it (AI wizard, manual form, or the chat-assisted challenge-draft path).
 * Switching to optional/required on an already-published opportunity is
 * server-rejected (updateApplicationModeAction) unless a real approved
 * challenge already exists — this panel just surfaces that error, it
 * never bypasses it.
 */
export function ApplicationModeSettings({ opportunityId, initial }: { opportunityId: string; initial: ApplicationMode }) {
  const [mode, setMode] = useState<ApplicationMode>(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  function save(next: ApplicationMode) {
    setMessage(null);
    startTransition(async () => {
      try {
        await updateApplicationModeAction(opportunityId, next);
        setMode(next);
        setMessage({ text: "Saved." });
      } catch (error) {
        setMessage({ text: error instanceof Error ? error.message : "Couldn't save.", error: true });
      }
    });
  }

  return (
    <section className="rounded-xl border border-navy/10 bg-white p-6">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="size-4 text-teal-ink" aria-hidden="true" />
        <h2 className="text-base font-semibold text-navy">How should students apply?</h2>
      </div>
      <div className="mt-4 space-y-2">
        {APPLICATION_MODE_OPTIONS.map((option) => (
          <label key={option} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${mode === option ? "border-teal/40 bg-teal/5" : "border-navy/10"}`}>
            <input
              type="radio"
              name="applicationMode"
              value={option}
              checked={mode === option}
              disabled={pending}
              onChange={() => save(option)}
              className="mt-1 size-4 shrink-0 accent-teal-ink"
            />
            <span>
              <span className="block text-sm font-medium text-navy">{APPLICATION_MODE_LABEL[option]}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-navy/60">{APPLICATION_MODE_COMPANY_DESCRIPTION[option]}</span>
            </span>
          </label>
        ))}
      </div>
      {message && <p role={message.error ? "alert" : "status"} className={`mt-3 text-sm ${message.error ? "text-red-700" : "text-teal-ink"}`}>{message.text}</p>}
    </section>
  );
}
