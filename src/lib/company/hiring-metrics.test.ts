import { describe, it, expect } from "vitest";
import {
  hiringMetrics,
  hiringCohort,
  hiringActivity,
  type HiringApplication,
} from "./hiring-metrics";
import {
  hasPermission,
  permissionsFor,
  canManagePublication,
} from "./permissions";
import { groundedHighlights } from "./evidence-summary";

const now = new Date("2026-08-31T12:00:00Z");
function application(
  status: HiringApplication["status"],
  extra: Partial<HiringApplication> = {},
): HiringApplication {
  return {
    id: status,
    opportunityId: "data",
    name: "A candidate",
    status,
    appliedAt: new Date("2026-08-30T12:00:00Z"),
    submittedAt: now,
    offer: null,
    source: null,
    ...extra,
  };
}
describe("shared hiring metrics", () => {
  it("counts only the active reviewable pipeline, preserving archived and pre-submission records", () => {
    const m = hiringMetrics([
      application("applied"),
      application("shortlisted"),
      application("invited"),
      application("declined"),
      application("withdrawn"),
      application("applied", { submittedAt: null }),
    ]);
    expect(m).toMatchObject({
      applicants: 6,
      active: 3,
      toReview: 1,
      shortlisted: 1,
      offerSent: 1,
      archived: 2,
      awaitingSubmission: 1,
    });
  });
  it("distinguishes pending from accepted offers, and excludes pending from response acceptance", () => {
    const m = hiringMetrics([
      application("invited", {
        offer: { status: "accepted", sentAt: now, acceptedAt: now },
      }),
      application("invited", {
        offer: { status: "pending", sentAt: now, acceptedAt: null },
      }),
    ]);
    expect(m).toMatchObject({
      pending: 1,
      accepted: 1,
      offers: 2,
      acceptance: 1,
      timeToHire: 1,
    });
  });
  it("does not infer a hiring timestamp from an offer's mutable updatedAt", () => {
    expect(
      hiringMetrics([
        application("invited", {
          offer: { status: "accepted", sentAt: now, acceptedAt: null },
        }),
      ]).timeToHire,
    ).toBeNull();
  });
  it("scopes dates consistently and preserves totals in time buckets", () => {
    const rows = [
      application("applied"),
      application("shortlisted", { appliedAt: new Date("2025-01-01") }),
      application("invited", { appliedAt: new Date("2027-01-01") }),
    ];
    const cohort = hiringCohort(rows, 7, now);
    expect(cohort).toHaveLength(1);
    expect(
      hiringActivity(cohort, 7, now).reduce((n, p) => n + p.count, 0),
    ).toBe(1);
  });
  it("has honest empty-state values", () =>
    expect(hiringMetrics([])).toMatchObject({
      active: 0,
      acceptance: null,
      timeToHire: null,
    }));
});
describe("workspace access", () => {
  it("does not silently expand legacy publication permissions", () => {
    expect(canManagePublication({ role: "member", permissions: null })).toBe(
      false,
    );
    expect(canManagePublication({ role: "admin", permissions: null })).toBe(
      true,
    );
    expect(
      canManagePublication({ role: "member", permissions: ["hiring_access"] }),
    ).toBe(true);
    expect(
      canManagePublication({
        role: "member",
        permissions: ["hiring_reviewer"],
      }),
    ).toBe(false);
  });
  it("preserves legacy members and supports multiple permissions", () => {
    expect(
      hasPermission({ role: "member", permissions: null }, "hiring_access"),
    ).toBe(true);
    expect(
      permissionsFor({
        role: "member",
        permissions: ["hiring_reviewer", "program_supervisor"],
      }),
    ).toHaveLength(2);
  });
  it("does not give hiring or admin access to a program-only member", () => {
    const member = { role: "member", permissions: ["program_supervisor"] };
    expect(hasPermission(member, "hiring_reviewer")).toBe(false);
    expect(hasPermission(member, "workspace_admin")).toBe(false);
  });
  it("separates posting management from candidate review", () => {
    expect(
      hasPermission(
        { role: "member", permissions: ["hiring_reviewer"] },
        "hiring_access",
      ),
    ).toBe(false);
    expect(
      hasPermission(
        { role: "member", permissions: ["hiring_access"] },
        "hiring_reviewer",
      ),
    ).toBe(true);
  });
  it("owner access cannot be removed with an empty permission list", () =>
    expect(
      hasPermission({ role: "owner", permissions: [] }, "workspace_admin"),
    ).toBe(true));
});
describe("evidence grounding", () => {
  const source = {
    id: "submission",
    label: "Analysis.pdf",
    kind: "submission" as const,
    text: "Dock 3 accounted for the largest share of delayed shipments.",
  };
  it("discards fabricated, incorrectly sourced and duplicated highlights", () => {
    expect(
      groundedHighlights(
        {
          highlights: [
            {
              section: "challenge",
              sourceId: "submission",
              quote: source.text,
            },
            {
              section: "strengths",
              sourceId: "submission",
              quote: source.text,
            },
            {
              section: "background",
              sourceId: "submission",
              quote: source.text,
            },
            {
              section: "challenge",
              sourceId: "submission",
              quote: "All 3 tasks were completed perfectly.",
            },
          ],
        },
        [source],
      ),
    ).toEqual([
      { section: "challenge", sourceId: "submission", quote: source.text },
    ]);
  });
  it("never turns self-reported profile skills into proven strengths", () => {
    expect(
      groundedHighlights(
        {
          highlights: [
            {
              section: "strengths",
              sourceId: "profile",
              quote: "SQL, Python, data analysis",
            },
          ],
        },
        [
          {
            id: "profile",
            kind: "profile",
            label: "Profile",
            text: "SQL, Python, data analysis",
          },
        ],
      ),
    ).toHaveLength(0);
  });
});
