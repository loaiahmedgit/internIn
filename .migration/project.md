# project

2026-08-31 — whole-project scan, no migration needed.

## Changed

None. `npx shadcn@latest info --json` reports `"base": "base"`, style `base-nova` — the project is already fully on `@base-ui/react`.

## Left alone

Everything. `grep -rl "radix-ui\|@radix-ui" src` returns zero matches project-wide (checked `src/components/ui` and the full `src` tree). No Radix packages, no `asChild` usage, no radix wrapper files exist to migrate.

## Behavior changes

None.

## Verify by hand

N/A — no files touched.

**0 wrappers remain on Radix** (derived from `grep -rl "radix-ui\|@radix-ui" src`).
