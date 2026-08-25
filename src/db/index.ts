import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Lazily-created so the app can still build/render without DATABASE_URL set
 * (Phase 1 demo routes don't touch the DB at all). Any code path that
 * actually calls db.* will throw a clear error if the env var is missing,
 * rather than the whole app failing to start.
 */
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local (see .env.local.example) to use the database.",
    );
  }
  const client = postgres(url, { prepare: false });
  _db = drizzle(client, { schema });
  return _db;
}

export * as schema from "./schema";
