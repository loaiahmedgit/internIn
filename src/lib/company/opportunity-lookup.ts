import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

/**
 * Resolves a role NAME the employer typed in plain conversation ("the
 * Database Intern challenge") to real internships in their own company —
 * never guesses a single match when several fit; the caller decides what
 * to do with 0 or 2+ results (ask, or show a real disambiguation choice).
 */
export async function resolveOpportunityByName(companyId: string, name: string): Promise<{ id: string; role: string }[]> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.opportunities.id, role: schema.opportunities.role })
    .from(schema.opportunities)
    .where(eq(schema.opportunities.companyId, companyId));

  const needle = name.trim().toLowerCase();
  if (!needle) return [];
  return rows.filter((r) => r.role.toLowerCase().includes(needle) || needle.includes(r.role.toLowerCase()));
}
