import { describe, expect, it } from "vitest";
import { formatRecentDate } from "@/lib/format-date";

describe("formatRecentDate", () => {
  it("uses the workspace timezone consistently around UTC midnight", () => {
    const now = new Date("2026-08-30T10:00:00.000Z");

    expect(formatRecentDate(new Date("2026-08-28T22:30:00.000Z"), now)).toBe("Yesterday");
    expect(formatRecentDate(new Date("2026-08-29T22:30:00.000Z"), now)).toBe("Today");
  });

  it("formats older dates in the same timezone", () => {
    const now = new Date("2026-08-30T10:00:00.000Z");

    expect(formatRecentDate(new Date("2026-08-27T21:00:00.000Z"), now)).toBe("Aug 28");
  });
});
