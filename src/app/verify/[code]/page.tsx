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
    title: `Verified Challenge Credential — ${code}`,
    description: "internIn Verified Challenge Credential verification.",
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
          <p className="text-xs font-semibold tracking-wide text-teal-ink uppercase">Verified Challenge Credential</p>
          <h1 className="mt-1.5 text-xl leading-tight font-semibold text-balance text-navy">{credential.displayTitle}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-navy/60">
            <span>{credential.studentDisplayName}</span>
            <span aria-hidden="true">·</span>
            <span>Challenge associated with {credential.companyDisplayName}</span>
          </div>

          {credential.companyEndorsed && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal-ink">Company Endorsed</span>
          )}

          <div
            className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              isValid ? "bg-teal/10 text-teal-ink" : "bg-navy/6 text-navy/60"
            }`}
          >
            {isValid ? <BadgeCheck className="size-3.5" aria-hidden="true" /> : <Ban className="size-3.5" aria-hidden="true" />}
            {isValid ? "Valid" : "Revoked"}
          </div>

          {credential.issuedAt && <p className="mt-3 text-sm text-navy/55">Issued {monthYear.format(new Date(credential.issuedAt))}</p>}

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

          {!isValid && credential.revocationReasonPublic && <p className="mt-4 text-xs leading-5 text-navy/50">{credential.revocationReasonPublic}</p>}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-navy/8 pt-4 text-xs text-navy/45">
            <span className="break-words">Credential ID: {credential.verificationCode}</span>
          </div>

          <p className="mt-4 text-xs leading-5 text-navy/45">
            This credential verifies that the named student demonstrated evidence against the published challenge rubric. It does not represent an employment decision. Verified through internIn.
          </p>
        </div>
      </main>
    </div>
  );
}
