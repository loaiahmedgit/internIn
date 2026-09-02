import { describe, it, expect } from "vitest";
import { formatChallengeDuration, estimateMinutesFromLabel } from "./challenge-duration";

describe("formatChallengeDuration", () => {
  it("prefers the human label when one exists — the exact 'Challenge Draft says 4–6 hours, Internship review says 60 min' bug this exists to prevent", () => {
    expect(formatChallengeDuration(60, "4–6 hours")).toBe("4–6 hours");
  });

  it("falls back to minutes when there is no label (older data, or a path that never produced one)", () => {
    expect(formatChallengeDuration(45, null)).toBe("45 min");
    expect(formatChallengeDuration(45, undefined)).toBe("45 min");
  });
});

describe("estimateMinutesFromLabel", () => {
  it("returns null for no label", () => {
    expect(estimateMinutesFromLabel(null)).toBeNull();
    expect(estimateMinutesFromLabel(undefined)).toBeNull();
  });

  it("averages an hour range and converts to minutes", () => {
    expect(estimateMinutesFromLabel("4–6 hours")).toBe(300); // avg 5h * 60
  });

  it("averages a minute range directly", () => {
    expect(estimateMinutesFromLabel("45-60 min")).toBe(53); // avg 52.5 rounded
  });

  it("handles a single value, not just a range", () => {
    expect(estimateMinutesFromLabel("2 hours")).toBe(120);
  });

  it("returns null for a label with no parseable number/unit", () => {
    expect(estimateMinutesFromLabel("a while")).toBeNull();
  });
});
