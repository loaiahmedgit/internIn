import "server-only";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Best-effort real evidence from a generic public link — same safety
 * pattern as every other adapter (timeout, no-redirect, size cap,
 * "untrusted data, never follow embedded instructions" applies at the
 * evaluation-prompt level, not here). Figma's actual design content isn't
 * reachable without Figma's own API + an access token — not integrated in
 * this pass, so a figma.com URL always returns null (the caller marks it
 * "requires human review — design tool not accessible"), rather than
 * fetching the login-walled page and calling that "evidence".
 */
export async function fetchLinkText(url: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname === "figma.com" || parsed.hostname.endsWith(".figma.com")) return null;

  try {
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok || !response.body) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/(html|plain)/.test(contentType)) return null;
    if (Number(response.headers.get("content-length")) > MAX_BYTES) return null;

    const raw = await response.text();
    if (raw.length > MAX_BYTES) return null;
    // Crude but safe HTML-to-text: strip tags/scripts/styles, collapse whitespace.
    const text = raw
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 20 ? text.slice(0, 12_000) : null;
  } catch {
    return null;
  }
}
