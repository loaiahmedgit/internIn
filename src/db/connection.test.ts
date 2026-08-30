import { expect, it } from "vitest";
import { runtimeDatabaseUrl } from "./connection";

it("uses the same Supabase database through its transaction pooler on Vercel", () => {
  const url = "postgres://user:encoded%40password@aws-0-example.pooler.supabase.com:5432/postgres?sslmode=require";
  expect(runtimeDatabaseUrl(url, true)).toBe(url.replace(":5432/", ":6543/"));
  expect(runtimeDatabaseUrl(url, false)).toBe(url);
});

it("preserves direct databases, custom hosts, and already-configured poolers", () => {
  for (const url of [
    "postgres://localhost:5432/internin",
    "postgres://db.example.supabase.co:5432/postgres",
    "postgres://aws-0-example.pooler.supabase.com:6543/postgres",
  ]) expect(runtimeDatabaseUrl(url, true)).toBe(url);
});
