/**
 * Real, detectable-only signal for where an applicant came from — no
 * fabricated "Organic/Direct/Referral" split. Only three buckets, because
 * only three are actually derivable from data we have:
 *  - "company_website": document.referrer's host matches the hiring
 *    company's own website (a real column on `companies`).
 *  - "direct": no referrer, or the referrer is internIn itself (the
 *    student was already browsing the site).
 *  - "referral": any other external referrer.
 */

export type ApplicationSource = "direct" | "referral" | "company_website";

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function classifyApplicationSource(params: {
  referrer: string | null | undefined;
  siteHost: string;
  companyWebsite: string | null | undefined;
}): ApplicationSource {
  const referrerHost = params.referrer ? hostOf(params.referrer) : null;
  if (!referrerHost) return "direct";
  if (referrerHost === hostOf(params.siteHost) || referrerHost === params.siteHost.replace(/^www\./, "")) {
    return "direct";
  }
  const companyHost = params.companyWebsite ? hostOf(params.companyWebsite) : null;
  if (companyHost && referrerHost === companyHost) return "company_website";
  return "referral";
}
