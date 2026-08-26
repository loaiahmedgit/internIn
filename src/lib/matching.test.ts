import { describe, it, expect } from "vitest";
import { computeMatchScore } from "./matching";

describe("computeMatchScore", () => {
  it("returns 100 when all opportunity skills are covered", () => {
    expect(computeMatchScore(["SQL", "Excel"], [], ["SQL", "Excel"])).toBe(100);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(computeMatchScore([" sql "], [], ["SQL"])).toBe(100);
  });

  it("counts interests alongside skills", () => {
    expect(computeMatchScore([], ["Marketing"], ["Marketing"])).toBe(100);
  });

  it("returns a partial percentage when only some skills match", () => {
    expect(computeMatchScore(["SQL"], [], ["SQL", "Excel", "Python", "R"])).toBe(25);
  });

  it("returns 0 when nothing matches", () => {
    expect(computeMatchScore(["Photoshop"], [], ["SQL", "Excel"])).toBe(0);
  });

  it("returns 0 for an opportunity with no declared skills", () => {
    expect(computeMatchScore(["SQL"], [], [])).toBe(0);
  });

  it("returns 0 for a student with no skills or interests", () => {
    expect(computeMatchScore([], [], ["SQL"])).toBe(0);
  });
});
