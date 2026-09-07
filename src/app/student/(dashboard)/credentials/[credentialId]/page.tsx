import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Ban, ChevronLeft, Download } from "lucide-react";
import { requireCurrentStudent } from "@/lib/auth";
import { getOwnedCredentialDetail } from "@/lib/credentials/student-credential-data";
import { getSiteUrl } from "@/lib/site-url";
import { CopyVerificationLinkButton } from "@/components/credentials/copy-verification-link-button";
import { AddToLinkedInDialog } from "@/components/credentials/add-to-linkedin-dialog";

export const dynamic = "force-dynamic";

const monthYear = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });

/**
 * The student's own proof record for one credential. Reads primarily from
 * the row's own snapshot columns (displayTitle, companyDisplayName,
 * rubricSnapshot, completedAt) — never re-derived from the live challenge/
 * company/rubric (docs/12 §7). companyEndorsed/status/verificationCode are
 * the row's live fields, not part of the frozen snapshot, and are read
 * live on purpose (endorsement can be withdrawn; status can be revoked).
 */
export default async function StudentCredentialDetailPage({ params }: { params: Promise<{ credentialId: string }> }) {
  const { credentialId } = await params;
  const { user } = await requireCurrentStudent();
  const credential = await getOwnedCredentialDetail(credentialId, user.id);
  if (!credential) notFound();

  const isValid = credential.status === "issued";
  const demonstratedCriteria = credential.rubricSnapshot.filter((entry) => entry.level === "strong" || entry.level === "solid");
  const verificationUrl = `${getSiteUrl()}/verify/${credential.verificationCode}`;

  return (
    <div className="mx-auto max-w-2xl px-6 pt-6 pb-14 sm:px-10 sm:pt-7">
      <Link href="/student/profile" className="inline-flex items-center gap-1 text-sm font-medium text-navy/55 hover:text-navy">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Back to profile
      </Link>

      <div className="mt-5 rounded-2xl border border-black/[0.05] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)] sm:p-8">
        <p className="text-xs font-semibold tracking-wide text-teal-ink uppercase">Verified Challenge Credential</p>
        <h1 className="mt-1.5 text-2xl leading-tight font-semibold text-balance text-navy">{credential.displayTitle}</h1>
        <p className="mt-1.5 text-sm text-navy/60">Challenge associated with {credential.companyDisplayName}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {credential.companyEndorsed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal-ink">Company Endorsed</span>
          )}
          <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${isValid ? "bg-teal/10 text-teal-ink" : "bg-navy/6 text-navy/60"}`}>
            {isValid ? <BadgeCheck className="size-3.5" aria-hidden="true" /> : <Ban className="size-3.5" aria-hidden="true" />}
            {isValid ? "Verified by internIn" : "Revoked"}
          </div>
        </div>

        {credential.issuedAt && <p className="mt-3 text-sm text-navy/55">Issued {monthYear.format(credential.issuedAt)}</p>}

        {demonstratedCriteria.length > 0 && (
          <div className="mt-6 border-t border-navy/8 pt-5">
            <h2 className="text-sm font-semibold text-navy">Demonstrated capabilities</h2>
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {demonstratedCriteria.map((entry) => (
                <li key={entry.criterion} className="rounded-full border border-navy/10 bg-[#fafcfc] px-2.5 py-1 text-xs text-navy/72">
                  {entry.criterion}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 border-t border-navy/8 pt-5">
          <h2 className="text-sm font-semibold text-navy">Credential information</h2>
          <dl className="mt-2.5 grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-navy/50">Credential ID</dt>
              <dd className="break-all text-right text-navy/72">{credential.verificationCode}</dd>
            </div>
            {credential.issuedAt && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-navy/50">Issued date</dt>
                <dd className="text-navy/72">{monthYear.format(credential.issuedAt)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-navy/50">Verification status</dt>
              <dd className="text-navy/72">{isValid ? "Valid" : "Revoked"}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 border-t border-navy/8 pt-5">
          <div className="flex flex-wrap gap-2">
            <CopyVerificationLinkButton url={verificationUrl} />
            {/* Download/LinkedIn only for a currently-valid credential — the
                verification link stays the authority either way (§21/§23):
                a revoked credential must never produce a fresh
                valid-looking PDF or be offered for new sharing. */}
            {isValid && credential.issuedAt && (
              <>
                <a
                  href={`/student/credentials/${credential.id}/pdf`}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-navy/12 bg-white px-3.5 text-sm font-medium text-navy transition-colors hover:border-teal/25 hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  Download PDF
                </a>
                <AddToLinkedInDialog
                  credentialName={`Verified Challenge Credential — ${credential.displayTitle}`}
                  issueDateLabel={monthYear.format(credential.issuedAt)}
                  credentialId={credential.verificationCode}
                  credentialUrl={verificationUrl}
                />
              </>
            )}
          </div>
          {!isValid && <p className="mt-3 text-xs text-navy/50">This credential has been revoked. It is no longer downloadable or shareable to new profiles.</p>}
        </div>
      </div>
    </div>
  );
}
