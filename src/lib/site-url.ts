/**
 * Canonical, environment-aware site URL — the one place a link that
 * leaves the server (a copy-verification-link action, a public page's
 * canonical metadata, …) computes its base from. Never hardcode
 * localhost or a temporary Vercel preview URL into anything shareable.
 * Mirrors the pattern already used ad hoc in src/lib/inngest/functions.ts's
 * local `appUrl()` — same env var, same fallback, extracted here so new
 * code has one shared source instead of a third copy.
 */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
