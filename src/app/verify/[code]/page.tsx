import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Ban } from "lucide-react";
import { Wordmark } from "@/components/ui/wordmark";
import { getPublicCredentialByCode } from "@/lib/credentials/public-lookup";

export const dynamic = "force-dynamic";

const monthYear = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });

/** Unlisted-by-link (docs/12 §21/§14): never indexed, never appears in a
 * sitemap, never surfaced through search — the only way here is the
 * exact code. */
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `internIn Challenge Evidence Credential — ${code}`,
    description: "internIn Challenge Evidence Credential verification.",
    robots: { index: false, follow: false },
  };
}

export default async function VerifyCredentialPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const result = await getPublicCredentialByCode(code);
  if (result.kind === "not_found") notFound();

  const credential = result.credential;
  const isValid = credential.status === "valid";

  return (
    <div className="flex min-h-dvh flex-col bg-[#f7f9f9]">
      <header className="border-b border-navy/8 bg-white">
        <div className="mx-auto max-w-3xl px-5 py-4">
          <Link href="/" aria-label="internIn home" className="inline-block rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal">
            <Wordmark size="sm" />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 justify-center px-5 py-10 sm:py-16">
        <div className="w-full max-w-lg rounded-2xl border border-navy/8 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)] sm:p-8">
          <p className="text-xs font-semibold tracking-wide text-teal-ink uppercase">internIn Challenge Evidence Credential</p>
          <h1 className="mt-1.5 text-xl leading-tight font-semibold text-balance text-navy">{credential.displayTitle}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-navy/60">
            <span>{credential.studentDisplayName}</span>
            <span aria-hidden="true">·</span>
            <span>Challenge associated with {credential.companyDisplayName}</span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                isValid ? "bg-teal/10 text-teal-ink" : "bg-navy/6 text-navy/60"
              }`}
            >
              {isValid ? <BadgeCheck className="size-3.5" aria-hidden="true" /> : <Ban className="size-3.5" aria-hidden="true" />}
              Evidence credential: {isValid ? "Valid" : "Revoked"}
            </div>

            <div
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                credential.companyEndorsed
                  ? "bg-teal/10 text-teal-ink"
                  : credential.endorsementWithdrawnAt
                    ? "bg-navy/6 text-navy/60"
                    : "bg-navy/4 text-navy/45"
              }`}
            >
              Company endorsement: {credential.companyEndorsed ? "Granted" : credential.endorsementWithdrawnAt ? "Withdrawn" : "Not granted"}
            </div>
          </div>

          {credential.issuedAt && <p className="mt-3 text-sm text-navy/55">Issued {monthYear.format(new Date(credential.issuedAt))}</p>}

          <p className="mt-3 text-xs leading-5 text-navy/50">Evidence from this Challenge met internIn&apos;s defined validation criteria. This is not an employment decision or a guarantee of future performance.</p>

          {credential.demonstratedCriteria.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold tracking-wide text-navy/45 uppercase">Demonstrated capabilities</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {credential.demonstratedCriteria.map((entry) => (
                  <li key={entry.criterion} className="rounded-full border border-navy/10 bg-[#fafcfc] px-2.5 py-1 text-xs text-navy/72">
                    {entry.criterion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {credential.companyEndorsed && credential.companyEndorsedCapabilities.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold tracking-wide text-navy/45 uppercase">Company-recognized evidence</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {credential.companyEndorsedCapabilities.map((capability) => (
                  <li key={capability} className="rounded-full border border-teal/20 bg-teal/6 px-2.5 py-1 text-xs text-teal-ink">
                    {capability}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs leading-5 text-navy/45">
                {credential.companyDisplayName} recognizes evidence in the capabilities above, demonstrated in this Challenge. This is not an employment decision or a guarantee of future performance.
              </p>
            </div>
          )}

          {!isValid && credential.revocationReasonPublic && <p className="mt-4 text-xs leading-5 text-navy/50">{credential.revocationReasonPublic}</p>}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-navy/8 pt-4 text-xs text-navy/45">
            <span className="break-words">Credential ID: {credential.verificationCode}</span>
          </div>

          <p className="mt-4 text-xs leading-5 text-navy/45">
            This credential confirms the named student&apos;s evidence against the published challenge rubric met internIn&apos;s validation criteria. It does not represent an employment decision or a guarantee of future performance. Issued through internIn.
          </p>
        </div>
      </main>
    </div>
  );
}
