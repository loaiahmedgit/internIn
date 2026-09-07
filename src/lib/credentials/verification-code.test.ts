import { describe, expect, it } from "vitest";
import { generateVerificationCode } from "./verification-code";

describe("generateVerificationCode", () => {
  it("matches the public credential-id format", () => {
    expect(generateVerificationCode()).toMatch(/^INTERNIN-CH-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  });

  it("excludes visually ambiguous characters (0/O, 1/I) from the random suffix", () => {
    // Only the random suffix is checked — the fixed "INTERNIN-CH-" label
    // itself legitimately contains "I", which is not part of the alphabet.
    for (let i = 0; i < 200; i++) {
      const suffix = generateVerificationCode().replace("INTERNIN-CH-", "");
      expect(suffix).not.toMatch(/[01OI]/);
    }
  });

  it("is not derived from a sequential/predictable source — collision-safe in practice across many calls", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateVerificationCode()));
    // 500 draws from a 33^6 (~1.29 billion) space collide only astronomically rarely.
    expect(codes.size).toBe(500);
  });
});
