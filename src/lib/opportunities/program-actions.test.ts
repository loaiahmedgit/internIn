import { beforeEach, describe, expect, it, vi } from "vitest";

// Same mocking shape as endorsement.test.ts — a queue of select results,
// since assertAssignedOrAdmin issues exactly one select when it doesn't
// short-circuit on the workspace_admin bypass.
const mocks = vi.hoisted(() => ({ selectResults: [] as unknown[][] }));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve(mocks.selectResults.shift() ?? []) }) }) }),
  }),
  // The module under test destructures column refs off several tables at
  // import time (module-level constants elsewhere in program-actions.ts);
  // a Proxy avoids having to enumerate every one just to satisfy imports —
  // assertAssignedOrAdmin itself only ever reads programSupervisorAssignments.
  schema: new Proxy({}, { get: () => new Proxy({}, { get: () => ({}) }) }),
}));

import { assertAssignedOrAdmin } from "./program-actions";

beforeEach(() => {
  mocks.selectResults = [];
});

describe("assertAssignedOrAdmin — Phase 6A supervisor-assignment scoping", () => {
  it("workspace_admin bypasses without needing an assignment row (no query issued)", async () => {
    await expect(
      assertAssignedOrAdmin("program-1", { id: "member-1", role: "member", permissions: ["workspace_admin"] }),
    ).resolves.toBeUndefined();
    // The bypass must short-circuit before any DB call — an empty queue
    // proves no select() ever consumed a result.
    expect(mocks.selectResults).toHaveLength(0);
  });

  it("owner role bypasses (permissionsFor grants every permission to owner)", async () => {
    await expect(
      assertAssignedOrAdmin("program-1", { id: "member-1", role: "owner", permissions: null }),
    ).resolves.toBeUndefined();
  });

  it("a program_supervisor holder WITH a real assignment row for this program is allowed", async () => {
    mocks.selectResults = [[{ id: "assignment-1" }]];
    await expect(
      assertAssignedOrAdmin("program-1", { id: "member-2", role: "member", permissions: ["program_supervisor"] }),
    ).resolves.toBeUndefined();
  });

  it("a program_supervisor holder with NO assignment row for this program is denied — the real Phase 6A gap this closes", async () => {
    mocks.selectResults = [[]];
    await expect(
      assertAssignedOrAdmin("program-1", { id: "member-3", role: "member", permissions: ["program_supervisor"] }),
    ).rejects.toThrow(/not assigned as a supervisor/i);
  });

  it("a legacy member (permissions: null) still gets the pre-6A fallback grants — must also require assignment, not bypass", async () => {
    mocks.selectResults = [[]];
    await expect(
      assertAssignedOrAdmin("program-1", { id: "member-4", role: "member", permissions: null }),
    ).rejects.toThrow(/not assigned as a supervisor/i);
  });
});
