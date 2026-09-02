import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssistantActionOfferCard, AssistantInternshipCreatedCard } from "./assistant-action-cards";

describe("assistant internship action cards", () => {
  it("removes the clicked create-internship offer instead of retaining a machine-state chip", () => {
    const html = renderToStaticMarkup(createElement(AssistantActionOfferCard, {
      data: { roleSummary: "Web Developer Intern" },
      selected: "create_internship_draft",
      disabled: true,
      onChoose: () => undefined,
    }));
    expect(html).toBe("");
    expect(html).not.toContain("Internship draft requested");
  });

  it("renders one compact review action after the draft is created", () => {
    const html = renderToStaticMarkup(createElement(AssistantInternshipCreatedCard, {
      data: { opportunityId: "opportunity-1", role: "Web Developer Intern" },
    }));
    expect(html).toContain("Internship draft created");
    expect(html).toContain("Web Developer Intern");
    expect(html).toContain("Review internship draft");
    expect(html.match(/Review internship draft/g)).toHaveLength(1);
  });
});
