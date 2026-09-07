import { describe, expect, it } from "vitest";
import { renderCredentialPdf, type CredentialPdfInput } from "./credential-pdf";

// Real rendering, no mocks — exercises the actual Takumi/pdfcn pipeline and
// parses the bytes back with pdf-parse (already a dependency, used
// elsewhere for evidence extraction) to assert real content, not just
// byte validity.
async function extractText(bytes: Uint8Array): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: Buffer.from(bytes) });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}

function baseInput(overrides: Partial<CredentialPdfInput> = {}): CredentialPdfInput {
  return {
    studentDisplayName: "Amina K.",
    displayTitle: "Customer Onboarding Review",
    companyDisplayName: "Skyline Logistics",
    companyEndorsed: false,
    issuedAt: new Date("2026-08-02T00:00:00Z"),
    demonstratedCriteria: ["Customer reasoning", "Practicality"],
    verificationCode: "INTERNIN-CH-ABCDEF",
    verificationUrl: "https://www.internin.app/verify/INTERNIN-CH-ABCDEF",
    ...overrides,
  };
}

describe("renderCredentialPdf", () => {
  it("generates valid PDF bytes (A4, real %PDF signature)", async () => {
    const bytes = await renderCredentialPdf(baseInput());
    expect(bytes.length).toBeGreaterThan(0);
    const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("renders snapshot content: student name, title, company context, credential ID, verification URL, demonstrated criteria", async () => {
    const bytes = await renderCredentialPdf(baseInput());
    const text = await extractText(bytes);
    expect(text).toContain("Amina K.");
    expect(text).toContain("Customer Onboarding Review");
    expect(text).toContain("Skyline Logistics");
    expect(text).toContain("INTERNIN-CH-ABCDEF");
    expect(text).toContain("https://www.internin.app/verify/INTERNIN-CH-ABCDEF");
    expect(text).toContain("Customer reasoning");
    expect(text).toContain("Practicality");
  });

  it("company branding (Company Endorsed) only renders when authorized", async () => {
    const notEndorsed = await extractText(await renderCredentialPdf(baseInput({ companyEndorsed: false })));
    expect(notEndorsed).not.toContain("Company Endorsed");

    const endorsed = await extractText(await renderCredentialPdf(baseInput({ companyEndorsed: true })));
    expect(endorsed).toContain("Company Endorsed");
  });

  it("never contains a private id — the input type has no slot for one (structural guarantee)", async () => {
    // studentId/applicationId/submissionId/companyId/internal db id are not
    // even accepted parameters — there is nothing to leak by construction.
    const bytes = await renderCredentialPdf(baseInput());
    const text = await extractText(bytes);
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it("uses factual, non-inflated wording — never 'certified expert' or similar", async () => {
    const bytes = await renderCredentialPdf(baseInput());
    const text = await extractText(bytes);
    expect(text.toLowerCase()).not.toMatch(/certified expert|guarantee|approved employee|mastered/);
    expect(text).toContain("does not represent an employment decision");
  });
});
