import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ postgres: vi.fn(() => ({})), drizzle: vi.fn(() => ({})) }));
vi.mock("postgres", () => ({ default: mocks.postgres }));
vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: mocks.drizzle }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

it("reuses a bounded pool and releases idle database connections", async () => {
  vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
  const { getDb } = await import("./index");
  expect(getDb()).toBe(getDb());
  expect(mocks.postgres).toHaveBeenCalledExactlyOnceWith("postgres://localhost/test", {
    prepare: false,
    max: 2,
    idle_timeout: 20,
  });
});
