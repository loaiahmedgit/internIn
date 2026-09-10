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

import { grantCredentialCompanyEndorsement } from "./company-endorsement";

function credentialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "credential-1",
    status: "issued",
    policySnapshot: { policy: "company_endorsed", requireHumanConfirmation: false, showCompanyLogo: false },
    companyEndorsed: false,
    rubricSnapshot: [
      { criterion: "Customer reasoning", level: "strong" },
      { criterion: "Practicality", level: "solid" },
      { criterion: "Timeliness", level: "insufficient" },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  mocks.selectResults = [];
  mocks.setPayloads = [];
  mocks.insertedEvents = [];
});

describe("grantCredentialCompanyEndorsement", () => {
  it("this is the only function that can flip companyEndorsed to true — it does so when called with a valid demonstrated capability", async () => {
    mocks.selectResults = [[credentialRow()]];
    await grantCredentialCompanyEndorsement("credential-1", "approver-1", ["Customer reasoning"]);
    expect(mocks.setPayloads[0].companyEndorsed).toBe(true);
    expect(mocks.setPayloads[0].companyEndorsedByUserId).toBe("approver-1");
    expect(mocks.setPayloads[0].companyEndorsedCapabilities).toEqual(["Customer reasoning"]);
  });

  it("rejects a selection mixing a valid demonstrated capability with a non-demonstrated one — never silently drops the bad one and proceeds", async () => {
    mocks.selectResults = [[credentialRow()]];
    await expect(grantCredentialCompanyEndorsement("credential-1", "approver-1", ["Customer reasoning", "Timeliness"])).rejects.toThrow(/aren't part of this credential's demonstrated evidence/i);
    expect(mocks.setPayloads).toHaveLength(0);
  });

  it("rejects a selection that is entirely non-demonstrated capabilities", async () => {
    mocks.selectResults = [[credentialRow()]];
    await expect(grantCredentialCompanyEndorsement("credential-1", "approver-1", ["Timeliness"])).rejects.toThrow(/select at least one/i);
    expect(mocks.setPayloads).toHaveLength(0);
  });

  it("rejects an arbitrary unrelated capability string", async () => {
    mocks.selectResults = [[credentialRow()]];
    await expect(grantCredentialCompanyEndorsement("credential-1", "approver-1", ["Leadership excellence"])).rejects.toThrow();
    expect(mocks.setPayloads).toHaveLength(0);
  });

  it("requires at least one selected capability — never a blanket endorsement with nothing selected", async () => {
    mocks.selectResults = [[credentialRow()]];
    await expect(grantCredentialCompanyEndorsement("credential-1", "approver-1", [])).rejects.toThrow(/select at least one/i);
  });

  it("refuses when the credential is not yet issued", async () => {
    mocks.selectResults = [[credentialRow({ status: "pending_human_confirmation" })]];
    await expect(grantCredentialCompanyEndorsement("credential-1", "approver-1", ["Customer reasoning"])).rejects.toThrow(/only an issued evidence credential/i);
  });

  it("refuses when the challenge's policy doesn't offer company endorsement", async () => {
    mocks.selectResults = [[credentialRow({ policySnapshot: { policy: "internin_verified", requireHumanConfirmation: false, showCompanyLogo: false } })]];
    await expect(grantCredentialCompanyEndorsement("credential-1", "approver-1", ["Customer reasoning"])).rejects.toThrow(/isn't available for this credential/i);
  });

  it("refuses a second grant on an already-endorsed credential", async () => {
    mocks.selectResults = [[credentialRow({ companyEndorsed: true })]];
    await expect(grantCredentialCompanyEndorsement("credential-1", "approver-1", ["Customer reasoning"])).rejects.toThrow(/already endorsed/i);
  });

  it("a fresh grant clears any prior withdrawal fields on the row", async () => {
    mocks.selectResults = [[credentialRow({ endorsementWithdrawnAt: new Date(), endorsementWithdrawnByUserId: "old-approver", endorsementWithdrawalReason: "stale" })]];
    await grantCredentialCompanyEndorsement("credential-1", "approver-1", ["Customer reasoning"]);
    expect(mocks.setPayloads[0].endorsementWithdrawnAt).toBeNull();
    expect(mocks.setPayloads[0].endorsementWithdrawnByUserId).toBeNull();
    expect(mocks.setPayloads[0].endorsementWithdrawalReason).toBeNull();
  });

  it("logs credential_company_endorsement_granted with only the capability labels — no chain-of-thought or private evidence copy", async () => {
    mocks.selectResults = [[credentialRow()]];
    await grantCredentialCompanyEndorsement("credential-1", "approver-1", ["Customer reasoning"]);
    expect(mocks.insertedEvents).toHaveLength(1);
    expect(mocks.insertedEvents[0].eventType).toBe("credential_company_endorsement_granted");
    expect(mocks.insertedEvents[0].actorUserId).toBe("approver-1");
    expect(mocks.insertedEvents[0].metadata).toEqual({ capabilities: ["Customer reasoning"] });
  });
});
