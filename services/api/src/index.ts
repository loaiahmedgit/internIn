import Fastify from "fastify";

/**
 * internIn backend/API foundation — deliberately minimal. This is the
 * future home for long-running AI work, file processing, integrations,
 * and background jobs; the Next.js app on Vercel stays the frontend.
 * No existing business logic lives here yet — see services/api/README.md.
 */
const app = Fastify({ logger: true });

app.get("/health", async () => ({ status: "ok", service: "internin-api" }));

app.get("/api/status", async () => ({
  service: "internin-api",
  version: process.env.npm_package_version ?? "0.1.0",
  runtime: `node ${process.version}`,
  environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NODE_ENV ?? "unknown",
  uptimeSeconds: Math.round(process.uptime()),
}));

const port = Number(process.env.PORT) || 8080;

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
