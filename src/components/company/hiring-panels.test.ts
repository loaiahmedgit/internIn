import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HiringTrend } from "./hiring-panels";

describe("hiring chart server rendering", () => {
  it("renders SVG tooltip titles as one string so SSR and hydration agree", () => {
    const html = renderToStaticMarkup(createElement(HiringTrend, {
      points: [{ date: "2026-08-30T12:00:00.000Z", count: 7 }],
    }));
    expect(html).toContain("<title>Aug 30: 7 applicants</title>");
    expect(html).not.toContain("<title></title>");
  });
});
