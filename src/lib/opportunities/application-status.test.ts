import { describe, expect, it } from "vitest";
import { applicationStage, challengeState, CHALLENGE_STATE_BADGE_CLASS } from "./application-status";
import { getApplicationStages, getApplicationStageIndex } from "./application-stage";

describe("applicationStage — R2 §12 pure hiring stage, never Challenge-derived", () => {
  it("a fresh application with no submission is 'applied', never a Challenge-flavored stage", () => {
    expect(applicationStage({ status: "applied", hasSubmission: false })).toBe("applied");
  });

  it("a submission bumps to under_review regardless of mode-specific meaning", () => {
    expect(applicationStage({ status: "applied", hasSubmission: true })).toBe("under_review");
  });

  it("shortlisted/offer/closed states are unaffected by submission presence", () => {
    expect(applicationStage({ status: "shortlisted", hasSubmission: false })).toBe("shortlisted");
    expect(applicationStage({ status: "invited", hasSubmission: false, offerStatus: "pending" })).toBe("offer_pending");
    expect(applicationStage({ status: "applied", hasSubmission: false, offerStatus: "accepted" })).toBe("offer_accepted");
    expect(applicationStage({ status: "declined", hasSubmission: false })).toBe("closed");
  });
});

describe("challengeState — R2 §12 the separate, mode-aware row", () => {
  it("quick_apply never produces a Challenge row at all", () => {
    expect(challengeState({ applicationMode: "quick_apply", hasSubmission: false, challengeStarted: false })).toBeNull();
    expect(challengeState({ applicationMode: "quick_apply", hasSubmission: true, challengeStarted: true })).toBeNull();
  });

  it("optional + not attempted is its own neutral state, distinct from required", () => {
    const state = challengeState({ applicationMode: "optional_challenge", hasSubmission: false, challengeStarted: false });
    expect(state).toBe("optional_not_started");
  });

  it("optional non-completion is never rendered with the amber/warning class", () => {
    const state = challengeState({ applicationMode: "optional_challenge", hasSubmission: false, challengeStarted: false })!;
    expect(CHALLENGE_STATE_BADGE_CLASS[state]).not.toMatch(/amber|red/);
  });

  it("required + not started uses the amber blocking class — a genuine prerequisite", () => {
    const state = challengeState({ applicationMode: "challenge_required", hasSubmission: false, challengeStarted: false })!;
    expect(CHALLENGE_STATE_BADGE_CLASS[state]).toMatch(/amber/);
  });

  it("a submission always wins over challengeStarted, for both modes", () => {
    expect(challengeState({ applicationMode: "optional_challenge", hasSubmission: true, challengeStarted: true })).toBe("optional_submitted");
    expect(challengeState({ applicationMode: "challenge_required", hasSubmission: true, challengeStarted: false })).toBe("required_submitted");
  });
});

describe("application funnel — R2 §9 no fake Challenge step for quick_apply", () => {
  it("quick_apply funnel has no Challenge step", () => {
    expect(getApplicationStages("quick_apply")).not.toContain("Challenge");
  });

  it("optional_challenge and challenge_required both keep the Challenge step", () => {
    expect(getApplicationStages("optional_challenge")).toContain("Challenge");
    expect(getApplicationStages("challenge_required")).toContain("Challenge");
  });

  it("quick_apply's stage index skips the Challenge slot when shortlisted/invited", () => {
    const shortlisted = getApplicationStageIndex({ status: "shortlisted", hasSubmission: false, hasOffer: false, applicationMode: "quick_apply" });
    expect(getApplicationStages("quick_apply")[shortlisted]).toBe("Under review");
  });
});
