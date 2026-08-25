# internIn Design System

This file is the source of truth for internIn marketing and product UI. Page-specific files in `pages/` may refine layout, but they may not replace the approved brand identity.

## Direction

- Editorial, product-led, calm, precise, and trustworthy.
- Generous white space with thin modular borders and asymmetric product compositions.
- Product evidence is the visual story. Avoid stock imagery, glossy SaaS mockups, and decorative dashboards.
- Base.org informs the landing page rhythm: centered manifesto, quiet proof row, capability rail, product modules, a saturated closing band, and a structured footer.
- Do not copy Base branding, illustrations, wording, or blue palette.

## Brand

| Role | Value |
| --- | --- |
| Deep navy | `#213248` |
| Primary teal | `#1BA59C` |
| Light gray | `#F3F5F7` |
| Cool gray | `#C7CDD3` |
| White | `#FFFFFF` |

- Use the approved transparent wordmark at `/public/logo.png`.
- Never redraw, recolor, crop, or place the wordmark inside a decorative chip.
- Use teal sparingly for primary action, status, and the final conversion band.
- Use navy for typography and structural contrast.

## Typography

- Font: Geist for display and body, Geist Mono for compact data labels.
- Hero: 52–76px, tight tracking, no more than two lines on desktop.
- Section heading: 36–52px.
- Body: 15–18px with 1.55–1.7 line height.
- Labels: 11–12px, medium weight, moderate letter spacing. Avoid excessive uppercase.

## Layout

- Content width: 1180–1240px.
- Marketing horizontal padding: 20px mobile, 32px tablet, 40px desktop.
- Section rhythm: 88–144px desktop, 64–88px mobile.
- Hero should occupy most of the first viewport and contain the primary actions.
- Use borders to create modules. Reserve rounded surfaces for interactive controls and real product UI.
- Radius scale: 8px controls, 12px product surfaces. Do not use giant rounded containers.

## Motion

- Motion dial: 4/10.
- Use `motion/react` only for purposeful opacity/transform reveals and interactive demo state changes.
- Default duration: 240–420ms. No bouncy springs, parallax, scroll-jacking, or looping decoration.
- Respect `prefers-reduced-motion` in CSS and Motion components.

## Content

- Lead with the experience paradox and the proof-to-opportunity transformation.
- AI assists companies; it never makes the hiring decision.
- Say “evidence,” not “AI score.”
- Challenges are synthetic, sanitized, simulated, and limited. They cannot produce unpaid production work.
- Pricing: students free; companies free to start; QAR 499 when an intern is hired.
- Avoid em dashes in visible marketing copy.

## Accessibility and interaction

- Minimum 4.5:1 body-text contrast.
- All targets at least 44px on touch layouts.
- Visible `:focus-visible` treatment on every control and link.
- Use native buttons, links, tables, headings, and lists before ARIA.
- Never hide required information behind hover.
- Verify at 375, 768, 1024, and 1440px with no horizontal overflow.

## Scoped exception — hero background

The hero (only) carries an ambient full-bleed particle field (`HeroThreeField`,
three.js `Points`, brand colors, opacity ≤0.4, slow drift, respects
`prefers-reduced-motion`) plus a cursor-following ASCII trail
(`AsciiMouseTrail`, canvas 2D, disabled on touch and reduced-motion). Both are
masked by the existing white radial/edge gradients so they read as texture,
not a demo. This is a deliberate, narrow exception to "no 3D" below —
requested explicitly, referencing base.org's hero. Do not extend either
pattern to other sections without asking.

## Forbidden patterns

- Unnecessary gradients, glows, glassmorphism, floating blobs, or 3D (outside the hero exception above).
- Repeated equal-sized card grids and icon-card filler.
- Fake browser windows or div-based screenshot mockups.
- Large AI sparkle icons as primary decoration.
- Generic claims, invented customer logos, invented performance metrics, or unsupported social proof.
- Multiple competing accent colors.
