import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

/**
 * Read-only — used by server components (Home, /student/opportunities,
 * /student/dashboard right column) to know which opportunities to render
 * as already bookmarked. The write path (toggleSaveOpportunityAction) lives
 * in student-actions.ts alongside the rest of the student server actions.
 */
export async function getSavedOpportunityIds(studentUserId: string): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ opportunityId: schema.savedOpportunities.opportunityId })
    .from(schema.savedOpportunities)
    .where(eq(schema.savedOpportunities.studentId, studentUserId));
  return new Set(rows.map((r) => r.opportunityId));
}
