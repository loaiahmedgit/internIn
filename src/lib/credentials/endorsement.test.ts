import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
  setPayloads: [] as Record<string, unknown>[],
  insertedEvents: [] as Record<string, unknown>[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve(mocks.selectResults.shift() ?? []) }) }) }),
    update: () => ({
      set: (payload: Record<string, unknown>) => {
        mocks.setPayloads.push(payload);
        return { where: () => ({ returning: () => Promise.resolve([{ ...credentialRow(), ...payload }]) }) };
      },
    }),
    insert: () => ({ values: (payload: Record<string, unknown>) => (mocks.insertedEvents.push(payload), Promise.resolve()) }),
  }),
  schema: { challengeCredentials: {}, eventLog: {} },
}));

import { withdrawCredentialEndorsement } from "./endorsement";

function credentialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "credential-1",
    status: "issued",
    companyEndorsed: true,
    endorsementWithdrawnAt: null,
    endorsementWithdrawalReason: null,
    revokedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.selectResults = [];
  mocks.setPayloads = [];
  mocks.insertedEvents = [];
});

describe("withdrawCredentialEndorsement", () => {
  it("preserves the base credential — status/revokedAt are never touched by the update payload", async () => {
    mocks.selectResults = [[credentialRow()]];
    await withdrawCredentialEndorsement("credential-1", "reviewer-1", "No longer accurate.");

    expect(mocks.setPayloads).toHaveLength(1);
    const payload = mocks.setPayloads[0];
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("revokedAt");
    expect(payload.companyEndorsed).toBe(false);
    expect(payload.endorsementWithdrawalReason).toBe("No longer accurate.");
  });

  it("logs credential_endorsement_withdrawn, not credential_revoked", async () => {
    mocks.selectResults = [[credentialRow()]];
    await withdrawCredentialEndorsement("credential-1", "reviewer-1", "No longer accurate.");
    expect(mocks.insertedEvents).toHaveLength(1);
    expect(mocks.insertedEvents[0].eventType).toBe("credential_endorsement_withdrawn");
  });

  it("refuses to withdraw endorsement from an already-revoked credential", async () => {
    mocks.selectResults = [[credentialRow({ status: "revoked" })]];
    await expect(withdrawCredentialEndorsement("credential-1", "reviewer-1", "reason")).rejects.toThrow(/already been revoked/i);
  });

  it("refuses when there is no endorsement to withdraw", async () => {
    mocks.selectResults = [[credentialRow({ companyEndorsed: false })]];
    await expect(withdrawCredentialEndorsement("credential-1", "reviewer-1", "reason")).rejects.toThrow(/not currently endorsed/i);
  });

  it("requires a non-empty reason", async () => {
    mocks.selectResults = [[credentialRow()]];
    await expect(withdrawCredentialEndorsement("credential-1", "reviewer-1", "  ")).rejects.toThrow(/reason is required/i);
  });
});
