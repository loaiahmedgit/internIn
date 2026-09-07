import { afterEach, describe, expect, it } from "vitest";
import { getSiteUrl } from "./site-url";

describe("getSiteUrl", () => {
  const original = process.env.NEXT_PUBLIC_APP_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = original;
  });

  it("returns the configured canonical site URL, never window.location", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.internin.app";
    expect(getSiteUrl()).toBe("https://www.internin.app");
  });

  it("falls back to localhost only when the env var is genuinely unset (dev)", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });
});
