import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { toPublicCredentialDto, type PublicCredentialDto } from "./public-dto";

/** Matches generateVerificationCode()'s exact output shape — validated
 * before ever touching the DB so a malformed/garbage path segment never
 * even becomes a query (§14: "Validate verification code format before
 * query"). */
const VERIFICATION_CODE_FORMAT = /^INTERNIN-CH-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;

export type PublicCredentialLookupResult = { kind: "found"; credential: PublicCredentialDto } | { kind: "not_found" };

/**
 * The one scoped server-side entry point for public credential
 * verification — no broad anon SELECT policy exists on
 * `challenge_credentials` (checked: 0023's RLS grants nothing to anon),
 * so this is the only path a public request can reach a credential
 * through. Lookup is by the random `verification_code` only — never the
 * row's own uuid, never exposed to a caller. A row that exists but was
 * never actually issued (`pending_human_confirmation`) is deliberately
 * indistinguishable from a code that doesn't exist at all — no
 * enumeration, no "this code exists but isn't ready yet" leak.
 */
export async function getPublicCredentialByCode(code: string): Promise<PublicCredentialLookupResult> {
  if (!VERIFICATION_CODE_FORMAT.test(code)) return { kind: "not_found" };

  const db = getDb();
  const [row] = await db.select().from(schema.challengeCredentials).where(eq(schema.challengeCredentials.verificationCode, code)).limit(1);
  if (!row || row.status === "pending_human_confirmation" || !row.isPubliclyShared) return { kind: "not_found" };

  const [student] = await db.select({ fullName: schema.users.fullName }).from(schema.users).where(eq(schema.users.id, row.studentId)).limit(1);
  return { kind: "found", credential: toPublicCredentialDto(row, student?.fullName ?? "internIn student") };
}
