import { randomInt } from "node:crypto";

/**
 * Cryptographically random, non-sequential, unguessable public identifier —
 * INTERNIN-CH-XXXXXX. Never derived from the row's uuid or any DB sequence
 * (see docs/12 §11/§22). Base32-ish alphabet with visually ambiguous
 * characters (0/O, 1/I) excluded. Collision handling is the CALLER's job
 * (retry on the table's unique constraint) — this only generates one
 * candidate, matching how any collision-safe random-token generator in
 * this stack is expected to be used.
 */
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;

export function generateVerificationCode(): string {
  let suffix = "";
  for (let i = 0; i < CODE_LENGTH; i++) suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `INTERNIN-CH-${suffix}`;
}
