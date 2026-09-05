# internin-api

Minimal Fastify + TypeScript backend service, deployed on Railway. This is
the foundation for internIn's future persistent backend workloads —
long-running AI work, file processing, integrations, background jobs, and
queues/workers — **not** a replacement for the Next.js app on Vercel, which
remains the frontend.

## Architecture

- **Vercel** — Next.js frontend/UI (unchanged, `www.internin.app`)
- **Railway** — this service: persistent backend/API
- **Supabase** — Postgres, Auth, Storage (unchanged; this service does not
  duplicate or migrate any of it)

## Scope right now

Just two routes, proving the deployment foundation:

- `GET /health` → `{ "status": "ok", "service": "internin-api" }`
- `GET /api/status` → safe, non-secret service/version/runtime info

No existing internIn business logic (profile, challenges, applications, AI
evaluation) has been moved here yet. That migration happens deliberately,
workload by workload, once this foundation is proven healthy in production.

## Local development

```bash
npm install
npm run dev     # tsx watch, http://localhost:8080
npm run build   # tsc -> dist/
npm start       # node dist/index.js
```

The server listens on `process.env.PORT` (falls back to `8080` locally) —
never hardcode a port, Railway assigns one at runtime.

## Deployment

Deployed on Railway as its own service, root directory `services/api`,
built via Nixpacks (`railway.json` in this directory configures the health
check path and restart policy). Connect to Supabase using the same
`DATABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` env vars already used by the
Next.js app, set directly on the Railway service — never hardcoded here.
