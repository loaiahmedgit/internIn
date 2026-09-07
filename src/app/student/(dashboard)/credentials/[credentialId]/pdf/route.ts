import { NextResponse } from "next/server";
import { requireCurrentStudent } from "@/lib/auth";
import { getOwnedCredentialDetail } from "@/lib/credentials/student-credential-data";
import { renderCredentialPdf } from "@/lib/pdf/documents/credential-pdf";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

function sanitizeFilenameSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Student-only PDF download for their own credential — ownership checked
 * the same way as the detail page (getOwnedCredentialDetail). Generated
 * on request, not stored (Phase 4C §22): cheap, pure, deterministic from
 * the snapshot, no caching complexity needed for v1. Refuses anything but
 * a real `issued` credential — never produces a valid-looking PDF for a
 * pending or revoked one (§21/§23).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ credentialId: string }> }) {
  const { credentialId } = await params;
  const { user } = await requireCurrentStudent();
  const credential = await getOwnedCredentialDetail(credentialId, user.id);
  if (!credential) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (credential.status !== "issued" || !credential.issuedAt) {
    return NextResponse.json({ error: "This credential is not available for download." }, { status: 409 });
  }

  const demonstratedCriteria = credential.rubricSnapshot.filter((entry) => entry.level === "strong" || entry.level === "solid").map((entry) => entry.criterion);
  const bytes = await renderCredentialPdf({
    studentDisplayName: user.fullName,
    displayTitle: credential.displayTitle,
    companyDisplayName: credential.companyDisplayName,
    companyEndorsed: credential.companyEndorsed,
    issuedAt: credential.issuedAt,
    demonstratedCriteria,
    verificationCode: credential.verificationCode,
    verificationUrl: `${getSiteUrl()}/verify/${credential.verificationCode}`,
  });

  const filename = `internin-verified-challenge-${sanitizeFilenameSegment(credential.verificationCode)}.pdf`;
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
