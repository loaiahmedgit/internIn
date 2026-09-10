import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  requireStudent: vi.fn(),
  published: true,
  preexisting: false,
  rows: [] as { id: string }[],
  events: [] as Record<string, unknown>[],
  failAudit: false,
}));

vi.mock("@/lib/auth", () => ({ requireCurrentStudent: state.requireStudent }));
vi.mock("@/lib/inngest/client", () => ({ sendNotificationEvent: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/db", async () => {
  const schema = await import("@/db/schema");
  const db = {
    select: () => {
      let table: unknown;
      const query = {
        from: (value: unknown) => { table = value; return query; },
        innerJoin: () => query,
        where: () => query,
        limit: async () => table === schema.opportunities
          ? [{ opportunity: { status: state.published ? "published" : "closed", role: "Support Intern", applicationQuestions: ["Write a handoff."], updatedAt: new Date("2026-09-10T00:00:00Z") }, companyWebsite: null }]
          : state.preexisting ? state.rows : [],
      };
      return query;
    },
    transaction: async (run: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: () => {
          let table: unknown;
          const query = { from: (value: unknown) => { table = value; return query; }, where: () => query, limit: () => query, for: () => query,
            then: (resolve: (value: unknown) => void) => resolve(table === schema.opportunities ? [{ status: "published", updatedAt: new Date("2026-09-10T00:00:00Z") }] : state.rows) };
          return query;
        },
        insert: (table: unknown) => ({
          values: (value: Record<string, unknown>) => {
            if (table === schema.eventLog) {
              if (state.failAudit) { state.rows = []; throw new Error("Audit write failed"); }
              state.events.push(value);
              return Promise.resolve();
            }
            return { onConflictDoNothing: () => ({ returning: async () => {
              if (state.rows.length) return [];
              const row = { id: "canonical-application" };
              state.rows.push(row);
              return [row];
            } }) };
          },
        }),
      };
      return run(tx);
    },
  };
  return { schema, getDb: () => db };
});

import { applyToOpportunityAction } from "./student-actions";
const opportunityId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  state.requireStudent.mockReset().mockResolvedValue({ user: { id: "student-owner" } });
  state.published = true;
  state.preexisting = false;
  state.rows = [];
  state.events = [];
  state.failAudit = false;
});

describe("canonical application retries", () => {
  it("returns one application and one audit event for simultaneous requests", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => applyToOpportunityAction(opportunityId, undefined, { answers: ["A response"], revision: "2026-09-10T00:00:00.000Z" })));
    expect(new Set(results)).toEqual(new Set(["canonical-application"]));
    expect(state.rows).toHaveLength(1);
    expect(state.events).toEqual([expect.objectContaining({ actorUserId: "student-owner", eventType: "application_created" })]);
  });

  it("returns an existing application without another creation event", async () => {
    state.rows = [{ id: "original" }];
    state.preexisting = true;
    await expect(applyToOpportunityAction(opportunityId, undefined, { answers: ["A response"], revision: "2026-09-10T00:00:00.000Z" })).resolves.toBe("original");
    expect(state.events).toHaveLength(0);
  });

  it("rejects unauthenticated access before writing", async () => {
    state.requireStudent.mockRejectedValue(new Error("Not authenticated"));
    await expect(applyToOpportunityAction(opportunityId, undefined, { answers: ["A response"], revision: "2026-09-10T00:00:00.000Z" })).rejects.toThrow("Not authenticated");
    expect(state.rows).toHaveLength(0);
  });

  it("rejects invalid identifiers", async () => {
    await expect(applyToOpportunityAction("invalid")).rejects.toThrow();
    expect(state.rows).toHaveLength(0);
  });

  it("rejects closed postings", async () => {
    state.published = false;
    await expect(applyToOpportunityAction(opportunityId, undefined, { answers: ["A response"], revision: "2026-09-10T00:00:00.000Z" })).rejects.toThrow("isn't open");
    expect(state.rows).toHaveLength(0);
  });

  it("propagates an audit failure so the transaction cannot be reported as successful", async () => {
    state.failAudit = true;
    await expect(applyToOpportunityAction(opportunityId, undefined, { answers: ["A response"], revision: "2026-09-10T00:00:00.000Z" })).rejects.toThrow("Audit write failed");
  });
});
