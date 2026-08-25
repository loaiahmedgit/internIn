# Monetization Strategy

## Top-level decision

Do not charge separately for AI. Companies are not buying tokens — they're buying better intern selection, less HR work, and a structured internship afterward. AI is infrastructure, not a billable line item. Never show something like "100 AI credits — QAR 20"; that cheapens the product. The company should think "internIn created my challenge," not "I consumed 1,742 LLM tokens." Pricing must be tied to business value, not compute cost, with reasonable fair-use limits enforced quietly behind the scenes.

## Recommended v1 model: Free to start → pay when you hire

Companies can, for free: create an account, create an internship, use AI, generate a Challenge, publish, and review candidates.

When the company selects someone, a placement fee unlocks the internship-management layer:

**QAR 499 per successful intern**, which unlocks: internship offer, Internship Program Builder, intern management workspace, AI plan generation, progress tracking, final evaluation, and Verified Experience.

Pitch to companies: "You pay us only when we actually help you find an intern." No procurement person needs to understand token pricing.

**MVP implementation note:** the "pay when you hire" model is confirmed as part of the MVP, not deferred — "Invite to Internship" must visibly trigger the QAR 499 placement fee so the demo proves the full thesis end-to-end (see 08-page-list-and-data-model.md). The charge itself is stubbed for v1: no real payment processor integration, just a mocked/manual "paid" state that unlocks the Internship Program Builder and management workspace.

(An earlier framing of the same idea used a smaller flat "successful internship fee," e.g. QAR 200–500 per successful intern, while proving demand — the QAR 499-per-intern figure is the settled recommendation.)

## Later pricing tiers

- **Students**: Free, always. Charging students for the ability to get their first internship is backward — and paying should never rank a student higher (no pay-to-win). Optional future premium add-ons (AI career coach, advanced practice, interview prep) could exist but must not affect ranking or opportunity access.
- **Company Starter**: pay per successful intern (the v1 model above).
- **Company Pro**: roughly QAR 499–999/month — unlimited roles, more active internships, team members, candidate comparisons, analytics, custom challenge templates, company branding, internship cohorts.
- **Enterprise**: custom — SSO, API, roles/permissions, audit logs, custom policies, dedicated support.
- **Universities** (later, not v1): annual contract, placement dashboard, company network, student outcomes, hours completed, skills gained, supervisor evaluations.

## Company value proposition (what to actually sell)

Don't sell "help students" — companies don't buy charity. Sell: "Hire interns based on what they can do, not what their CV says," "Create a realistic work assessment in 10 minutes," and "Once you hire them, we structure the entire internship for you." The underlying benefits are less hiring risk, less HR work, better interns, and evidence instead of CV guessing.

## Student value proposition

"Stop being rejected because nobody gave you your first chance. Prove you can do the work." This is deliberately built to be emotionally strong.
