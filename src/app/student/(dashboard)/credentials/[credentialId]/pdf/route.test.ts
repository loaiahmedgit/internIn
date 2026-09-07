import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentStudent: vi.fn(),
  getOwnedCredentialDetail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireCurrentStudent: mocks.requireCurrentStudent }));
vi.mock("@/lib/credentials/student-credential-data", () => ({ getOwnedCredentialDetail: mocks.getOwnedCredentialDetail }));

import { GET } from "./route";

function credentialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "credential-1",
    status: "issued",
    issuedAt: new Date("2026-08-02T00:00:00Z"),
    displayTitle: "Customer Onboarding Review",
    companyDisplayName: "Skyline Logistics",
    companyEndorsed: false,
    verificationCode: "INTERNIN-CH-ABCDEF",
    rubricSnapshot: [
      { criterion: "Customer reasoning", level: "strong" },
      { criterion: "Timeliness", level: "insufficient" },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireCurrentStudent.mockResolvedValue({ user: { id: "student-1", fullName: "Amina K." } });
});

const params = () => Promise.resolve({ credentialId: "credential-1" });

describe("GET /student/credentials/[credentialId]/pdf", () => {
  it("unknown/not-owned credential returns 404", async () => {
    mocks.getOwnedCredentialDetail.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/x"), { params: params() });
    expect(response.status).toBe(404);
  });

  it("a revoked credential is blocked — never generates a fresh valid-looking PDF", async () => {
    mocks.getOwnedCredentialDetail.mockResolvedValue(credentialRow({ status: "revoked" }));
    const response = await GET(new Request("http://localhost/x"), { params: params() });
    expect(response.status).toBe(409);
    expect(response.headers.get("Content-Type")).not.toContain("application/pdf");
  });

  it("a pending_human_confirmation credential is blocked — not yet actually issued", async () => {
    mocks.getOwnedCredentialDetail.mockResolvedValue(credentialRow({ status: "pending_human_confirmation", issuedAt: null }));
    const response = await GET(new Request("http://localhost/x"), { params: params() });
    expect(response.status).toBe(409);
  });

  it("an issued credential returns a real PDF with a sanitized, sensible filename", async () => {
    mocks.getOwnedCredentialDetail.mockResolvedValue(credentialRow());
    const response = await GET(new Request("http://localhost/x"), { params: params() });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    const disposition = response.headers.get("Content-Disposition") ?? "";
    expect(disposition).toContain("attachment");
    expect(disposition).toMatch(/filename="internin-verified-challenge-internin-ch-abcdef\.pdf"/);
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");
  });
});
