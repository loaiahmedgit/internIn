"use server";

import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

const IdSchema = z.string().uuid();
const StudentTaskStatusSchema = z.enum(["pending", "in_progress", "blocked", "done"]);
const BlockerNoteSchema = z.string().trim().min(1).max(500);
const EvidenceNoteSchema = z.string().trim().max(1000);
const EvidenceUrlSchema = z.string().trim().url().max(500);

/**
 * Never trusts a client-supplied task id alone — same rule as every other
 * ownership check in src/lib/opportunities/*. Student-only: a company
 * member calling this would fail here even though they may legitimately
 * own the task through the company path — they have their own actions in
 * program-actions.ts and should never go through the student surface.
 */
async function assertOwnsTaskAsStudent(taskId: string, studentUserId: string) {
  const db = getDb();
  const [row] = await db
    .select({ task: schema.internshipTasks, studentId: schema.applications.studentId, programStatus: schema.internshipPrograms.status })
    .from(schema.internshipTasks)
    .innerJoin(schema.internshipWeeks, eq(schema.internshipTasks.weekId, schema.internshipWeeks.id))
    .innerJoin(schema.internshipPrograms, eq(schema.internshipWeeks.programId, schema.internshipPrograms.id))
    .innerJoin(schema.internshipOffers, eq(schema.internshipPrograms.offerId, schema.internshipOffers.id))
    .innerJoin(schema.applications, eq(schema.internshipOffers.applicationId, schema.applications.id))
    .where(eq(schema.internshipTasks.id, taskId))
    .limit(1);
  if (!row || row.studentId !== studentUserId) throw new Error("Not authorized for this task.");
  // The UI already hides every action once a program is completed (§22) —
  // this is the real server-side backstop, found missing during this
  // phase's own browser QA (a raw call would otherwise still succeed).
  if (row.programStatus === "completed") throw new Error("This internship is complete — its work is now a read-only record.");
  return row.task;
}

/**
 * The intern's own status transitions — Phase 6B §9. "Verified" is never
 * settable here: that stays a supervisor-side fact this phase doesn't
 * build a write path for (task-level verification doesn't exist in the
 * schema yet — see the final report's deferred-work note).
 */
export async function updateStudentTaskStatusAction(taskId: string, status: "pending" | "in_progress" | "blocked" | "done", blockerNote?: string) {
  const validatedTaskId = IdSchema.parse(taskId);
  const validatedStatus = StudentTaskStatusSchema.parse(status);
  const validatedBlockerNote = validatedStatus === "blocked" ? BlockerNoteSchema.parse(blockerNote) : null;
  const { user } = await requireCurrentStudent();
  const task = await assertOwnsTaskAsStudent(validatedTaskId, user.id);

  const db = getDb();
  await db
    .update(schema.internshipTasks)
    .set({ status: validatedStatus, blockerNote: validatedBlockerNote, updatedAt: new Date() })
    .where(eq(schema.internshipTasks.id, task.id));

  await db.insert(schema.eventLog).values({
    entityType: "internship_task",
    entityId: task.id,
    eventType: "internship_task_status_changed",
    actorUserId: user.id,
    metadata: { status: validatedStatus },
  });
}

/** A short work update and/or a real external link — Phase 6B §11. Either field alone is fine; both empty clears both. */
export async function updateStudentTaskEvidenceAction(taskId: string, input: { evidenceNote?: string; evidenceUrl?: string }) {
  const validatedTaskId = IdSchema.parse(taskId);
  const validatedNote = input.evidenceNote?.trim() ? EvidenceNoteSchema.parse(input.evidenceNote) : null;
  const validatedUrl = input.evidenceUrl?.trim() ? EvidenceUrlSchema.parse(input.evidenceUrl) : null;
  const { user } = await requireCurrentStudent();
  const task = await assertOwnsTaskAsStudent(validatedTaskId, user.id);

  const db = getDb();
  await db
    .update(schema.internshipTasks)
    .set({ evidenceNote: validatedNote, evidenceUrl: validatedUrl, updatedAt: new Date() })
    .where(eq(schema.internshipTasks.id, task.id));

  await db.insert(schema.eventLog).values({
    entityType: "internship_task",
    entityId: task.id,
    eventType: "internship_task_evidence_updated",
    actorUserId: user.id,
  });
}
