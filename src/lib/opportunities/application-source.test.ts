import { describe, it, expect } from "vitest";
import { classifyApplicationSource } from "./application-source";

describe("classifyApplicationSource", () => {
  it("is direct when there is no referrer", () => {
    expect(classifyApplicationSource({ referrer: null, siteHost: "internin.app", companyWebsite: null })).toBe("direct");
  });

  it("is direct when the referrer is the site itself", () => {
    expect(
      classifyApplicationSource({ referrer: "https://internin.app/opportunities", siteHost: "internin.app", companyWebsite: null }),
    ).toBe("direct");
  });

  it("is company_website when the referrer matches the hiring company's site", () => {
    expect(
      classifyApplicationSource({
        referrer: "https://www.acme.com/careers",
        siteHost: "internin.app",
        companyWebsite: "https://acme.com",
      }),
    ).toBe("company_website");
  });

  it("is referral for any other external referrer", () => {
    expect(
      classifyApplicationSource({ referrer: "https://linkedin.com/jobs/123", siteHost: "internin.app", companyWebsite: "https://acme.com" }),
    ).toBe("referral");
  });

  it("handles a malformed referrer without throwing", () => {
    expect(classifyApplicationSource({ referrer: "not-a-url", siteHost: "internin.app", companyWebsite: null })).toBe("direct");
  });
});
