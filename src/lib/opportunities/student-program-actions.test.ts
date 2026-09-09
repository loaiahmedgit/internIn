import { beforeEach, describe, expect, it, vi } from "vitest";

// Same mock-shift-queue pattern as program-actions.test.ts / endorsement.test.ts.
// select() returns a chain object whose innerJoin()/from()/where() all
// return itself (student-program-actions.ts's ownership query chains 4
// innerJoins before where().limit()) so the same mock works regardless of
// join count.
const mocks = vi.hoisted(() => ({
  currentUser: { id: "student-1" } as { id: string } | null,
  selectResults: [] as unknown[][],
  setPayloads: [] as Record<string, unknown>[],
  insertedEvents: [] as Record<string, unknown>[],
}));

function makeSelectChain() {
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(mocks.selectResults.shift() ?? []),
  };
  return chain;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  requireCurrentStudent: () => {
    if (!mocks.currentUser) throw new Error("Not signed in as a student.");
    return Promise.resolve({ user: mocks.currentUser });
  },
}));
vi.mock("@/db", () => ({
  getDb: () => ({
    select: () => makeSelectChain(),
    update: () => ({
      set: (payload: Record<string, unknown>) => {
        mocks.setPayloads.push(payload);
        return { where: () => Promise.resolve() };
      },
    }),
    insert: () => ({ values: (payload: Record<string, unknown>) => (mocks.insertedEvents.push(payload), Promise.resolve()) }),
  }),
  schema: new Proxy({}, { get: () => new Proxy({}, { get: () => ({}) }) }),
}));

import { updateStudentTaskStatusAction, updateStudentTaskEvidenceAction } from "./student-program-actions";

function taskRow(overrides: Record<string, unknown> = {}) {
  return {
    task: { id: "11111111-1111-4111-8111-111111111111", weekId: "week-1", title: "Task", description: null, status: "pending", blockerNote: null, evidenceNote: null, evidenceUrl: null },
    studentId: "student-1",
    programStatus: "active",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.currentUser = { id: "student-1" };
  mocks.selectResults = [];
  mocks.setPayloads = [];
  mocks.insertedEvents = [];
});

describe("updateStudentTaskStatusAction", () => {
  it("owning student can move a task to in_progress", async () => {
    mocks.selectResults = [[taskRow()]];
    await updateStudentTaskStatusAction("11111111-1111-4111-8111-111111111111", "in_progress");
    expect(mocks.setPayloads[0]).toMatchObject({ status: "in_progress", blockerNote: null });
    expect(mocks.insertedEvents[0]).toMatchObject({ eventType: "internship_task_status_changed", entityId: "11111111-1111-4111-8111-111111111111", actorUserId: "student-1" });
  });

  it("a different student's task is denied — real Phase 6B ownership check", async () => {
    mocks.selectResults = [[taskRow({ studentId: "some-other-student" })]];
    await expect(updateStudentTaskStatusAction("11111111-1111-4111-8111-111111111111", "in_progress")).rejects.toThrow(/not authorized/i);
  });

  it("no task found is denied the same way (never leaks existence)", async () => {
    mocks.selectResults = [[]];
    await expect(updateStudentTaskStatusAction("11111111-1111-4111-8111-111111111111", "in_progress")).rejects.toThrow(/not authorized/i);
  });

  it("a completed program's task is read-only server-side, not just hidden in the UI — real gap found during Phase 6B QA", async () => {
    mocks.selectResults = [[taskRow({ programStatus: "completed" })]];
    await expect(updateStudentTaskStatusAction("11111111-1111-4111-8111-111111111111", "in_progress")).rejects.toThrow(/read-only record/i);
    expect(mocks.setPayloads).toHaveLength(0);
  });

  it("marking blocked without a blocker note is rejected", async () => {
    mocks.selectResults = [[taskRow()]];
    await expect(updateStudentTaskStatusAction("11111111-1111-4111-8111-111111111111", "blocked")).rejects.toThrow();
    expect(mocks.setPayloads).toHaveLength(0);
  });

  it("marking blocked with a note persists the trimmed note", async () => {
    mocks.selectResults = [[taskRow()]];
    await updateStudentTaskStatusAction("11111111-1111-4111-8111-111111111111", "blocked", "  waiting on API access  ");
    expect(mocks.setPayloads[0]).toMatchObject({ status: "blocked", blockerNote: "waiting on API access" });
  });

  it("moving to done clears any blocker note", async () => {
    mocks.selectResults = [[taskRow({ task: { ...taskRow().task, status: "blocked", blockerNote: "old note" } })]];
    await updateStudentTaskStatusAction("11111111-1111-4111-8111-111111111111", "done");
    expect(mocks.setPayloads[0]).toMatchObject({ status: "done", blockerNote: null });
  });
});

describe("updateStudentTaskEvidenceAction", () => {
  it("saves a note and a url together", async () => {
    mocks.selectResults = [[taskRow()]];
    await updateStudentTaskEvidenceAction("11111111-1111-4111-8111-111111111111", { evidenceNote: "Shipped the dashboard", evidenceUrl: "https://example.com/pr/1" });
    expect(mocks.setPayloads[0]).toMatchObject({ evidenceNote: "Shipped the dashboard", evidenceUrl: "https://example.com/pr/1" });
    expect(mocks.insertedEvents[0]).toMatchObject({ eventType: "internship_task_evidence_updated" });
  });

  it("an invalid url is rejected before any write", async () => {
    mocks.selectResults = [[taskRow()]];
    await expect(updateStudentTaskEvidenceAction("11111111-1111-4111-8111-111111111111", { evidenceUrl: "not-a-url" })).rejects.toThrow();
    expect(mocks.setPayloads).toHaveLength(0);
  });

  it("clearing both fields writes null, not empty strings", async () => {
    mocks.selectResults = [[taskRow()]];
    await updateStudentTaskEvidenceAction("11111111-1111-4111-8111-111111111111", { evidenceNote: "", evidenceUrl: "" });
    expect(mocks.setPayloads[0]).toMatchObject({ evidenceNote: null, evidenceUrl: null });
  });

  it("a different student's task is denied", async () => {
    mocks.selectResults = [[taskRow({ studentId: "some-other-student" })]];
    await expect(updateStudentTaskEvidenceAction("11111111-1111-4111-8111-111111111111", { evidenceNote: "x" })).rejects.toThrow(/not authorized/i);
  });
});
