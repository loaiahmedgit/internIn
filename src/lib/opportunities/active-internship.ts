import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

/**
 * The student's current accepted internship, if any — just enough to
 * label the persistent "Current internship" entry point in the student
 * top nav. Full program detail (week/progress) lives in the Internship
 * Workspace, not here; this never fetches program/week/task data.
 */
export async function getActiveInternshipSummary(studentUserId: string): Promise<{ role: string } | null> {
  const db = getDb();
  const [row] = await db
    .select({ role: schema.opportunities.role })
    .from(schema.internshipOffers)
    .innerJoin(schema.applications, eq(schema.internshipOffers.applicationId, schema.applications.id))
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .where(and(eq(schema.applications.studentId, studentUserId), eq(schema.internshipOffers.status, "accepted")))
    .limit(1);
  return row ?? null;
}
