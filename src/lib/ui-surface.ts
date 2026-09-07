/**
 * Canonical Student-app card surface — the shadow/border recipe already
 * shared byte-for-byte between HomeOpportunityCard and ExploreOpportunityCard
 * (confirmed identical by audit). Previously copy-pasted inline 3x on the
 * Home page (with drifted numbers vs Profile's own separate cardClass) and
 * a third, different recipe on Applications. This is the one Student-app
 * token; Profile's own cardClass is intentionally left alone (Profile is
 * done — not touched here).
 */
export const SURFACE_CARD_CLASS =
  "rounded-2xl border border-black/[0.04] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)]";

export const SURFACE_CARD_HOVER_CLASS =
  "transition-shadow duration-200 hover:shadow-[0_2px_4px_rgba(16,24,40,0.05),0_14px_32px_-6px_rgba(16,24,40,0.14)]";
