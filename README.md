# internIn

Companies describe an internship role to AI, which generates a safe simulated work Challenge. Students complete it and earn evidence-backed proof of their skills — not a CV. Companies review that evidence and invite strong candidates into a structured, AI-drafted internship program, ending in a Verified Experience record.

See [HANDOFF.md](./HANDOFF.md) for the full architecture, what's built, what's not, and how to resume work. Product spec lives in [docs/](./docs).

## Development

```bash
npm install
cp .env.local.example .env.local   # fill in DATABASE_URL / Supabase / OpenRouter keys
npm run dev
```

Without `DATABASE_URL`/`OPENROUTER_API_KEY` set, the app still runs — DB-backed routes fail closed with a clear error, and AI generation falls back to a deterministic mock provider.

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build (typecheck + lint)
- `npm test` — Vitest suite
- `npx drizzle-kit push` — apply schema to a connected Postgres database
