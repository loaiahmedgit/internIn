"use server";

import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { inngest } from "@/lib/inngest/client";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";

const IdSchema = z.string().uuid();

/**
 * Every task/feedback write below re-derives company ownership by walking
 * week/program → offer → application → opportunity itself — same rule as
 * the rest of src/lib/opportunities/*: never trust a client-supplied id.
 */
async function assertOwnsWeek(weekId: string, companyId: string) {
  const db = getDb();
  const [row] = await db
    .select({ week: schema.internshipWeeks, opportunityCompanyId: schema.opportunities.companyId })
    .from(schema.internshipWeeks)
    .innerJoin(schema.internshipPrograms, eq(schema.internshipWeeks.programId, schema.internshipPrograms.id))
    .innerJoin(schema.internshipOffers, eq(schema.internshipPrograms.offerId, schema.internshipOffers.id))
    .innerJoin(schema.applications, eq(schema.internshipOffers.applicationId, schema.applications.id))
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .where(eq(schema.internshipWeeks.id, weekId))
    .limit(1);
  if (!row || row.opportunityCompanyId !== companyId) throw new Error("Not authorized for this week.");
  return row.week;
}

async function assertOwnsTask(taskId: string, companyId: string) {
  const db = getDb();
  const [row] = await db
    .select({ task: schema.internshipTasks, opportunityCompanyId: schema.opportunities.companyId })
    .from(schema.internshipTasks)
    .innerJoin(schema.internshipWeeks, eq(schema.internshipTasks.weekId, schema.internshipWeeks.id))
    .innerJoin(schema.internshipPrograms, eq(schema.internshipWeeks.programId, schema.internshipPrograms.id))
    .innerJoin(schema.internshipOffers, eq(schema.internshipPrograms.offerId, schema.internshipOffers.id))
    .innerJoin(schema.applications, eq(schema.internshipOffers.applicationId, schema.applications.id))
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .where(eq(schema.internshipTasks.id, taskId))
    .limit(1);
  if (!row || row.opportunityCompanyId !== companyId) throw new Error("Not authorized for this task.");
  return row.task;
}

async function assertOwnsProgram(programId: string, companyId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      program: schema.internshipPrograms,
      opportunityCompanyId: schema.opportunities.companyId,
      opportunitySkills: schema.opportunities.skills,
      companyName: schema.companies.name,
      applicationId: schema.applications.id,
      studentEmail: schema.users.email,
      studentName: schema.users.fullName,
    })
    .from(schema.internshipPrograms)
    .innerJoin(schema.internshipOffers, eq(schema.internshipPrograms.offerId, schema.internshipOffers.id))
    .innerJoin(schema.applications, eq(schema.internshipOffers.applicationId, schema.applications.id))
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .innerJoin(schema.users, eq(schema.applications.studentId, schema.users.id))
    .where(eq(schema.internshipPrograms.id, programId))
    .limit(1);
  if (!row || row.opportunityCompanyId !== companyId) throw new Error("Not authorized for this program.");
  return row;
}

const TaskTitleSchema = z.string().trim().min(1).max(160);
const TaskDescriptionSchema = z.string().trim().max(2000);
const TaskStatusSchema = z.enum(["pending", "in_progress", "done"]);
const FeedbackSchema = z.string().trim().min(1).max(4000);

export async function addInternshipTaskAction(weekId: string, title: string, description?: string) {
  const validatedWeekId = IdSchema.parse(weekId);
  const validatedTitle = TaskTitleSchema.parse(title);
  const validatedDescription = description ? TaskDescriptionSchema.parse(description) : undefined;
  const { user, membership } = await requireCurrentCompanyMember("program_supervisor");
  const week = await assertOwnsWeek(validatedWeekId, membership.companyId);

  const [task] = await getDb()
    .insert(schema.internshipTasks)
    .values({ weekId: week.id, title: validatedTitle, description: validatedDescription ?? null })
    .returning();

  await getDb().insert(schema.eventLog).values({
    entityType: "internship_task",
    entityId: task.id,
    eventType: "internship_task_created",
    actorUserId: user.id,
  });

  return task.id as string;
}

export async function updateInternshipTaskStatusAction(taskId: string, status: "pending" | "in_progress" | "done") {
  const validatedTaskId = IdSchema.parse(taskId);
  const validatedStatus = TaskStatusSchema.parse(status);
  const { user, membership } = await requireCurrentCompanyMember("program_supervisor");
  const task = await assertOwnsTask(validatedTaskId, membership.companyId);

  const db = getDb();
  await db
    .update(schema.internshipTasks)
    .set({ status: validatedStatus, updatedAt: new Date() })
    .where(eq(schema.internshipTasks.id, task.id));

  await db.insert(schema.eventLog).values({
    entityType: "internship_task",
    entityId: task.id,
    eventType: "internship_task_status_changed",
    actorUserId: user.id,
    metadata: { status: validatedStatus },
  });
}

export async function addSupervisorFeedbackAction(programId: string, feedback: string, weekId?: string) {
  const validatedProgramId = IdSchema.parse(programId);
  const validatedFeedback = FeedbackSchema.parse(feedback);
  const validatedWeekId = weekId ? IdSchema.parse(weekId) : undefined;
  const { user, membership } = await requireCurrentCompanyMember("program_supervisor");
  const { program, companyName, applicationId, studentEmail, studentName } = await assertOwnsProgram(
    validatedProgramId,
    membership.companyId,
  );
  if (validatedWeekId) await assertOwnsWeek(validatedWeekId, membership.companyId);

  const db = getDb();
  const [entry] = await db
    .insert(schema.supervisorFeedback)
    .values({
      programId: program.id,
      weekId: validatedWeekId ?? null,
      authorUserId: user.id,
      feedback: validatedFeedback,
    })
    .returning();

  await db.insert(schema.eventLog).values({
    entityType: "internship_program",
    entityId: program.id,
    eventType: "supervisor_feedback_added",
    actorUserId: user.id,
  });

  await inngest.send({
    name: "supervisor_feedback/added",
    data: { studentEmail, studentName, companyName, feedback: validatedFeedback, applicationId },
  });

  return entry.id as string;
}

/**
 * Docs/04's closing step: a structured, evidence-backed record, not a
 * generic certificate. Work completed comes from tasks the supervisor
 * actually marked done (falls back to week titles if none were tracked);
 * skills demonstrated come from the opportunity's own declared skills — both
 * are facts already in the database, not something the AI invents here.
 * Completing a program is itself the supervisor verification act.
 */
export async function completeInternshipProgramAction(programId: string) {
  const validatedProgramId = IdSchema.parse(programId);
  const { user, membership } = await requireCurrentCompanyMember("program_supervisor");
  const { program, opportunitySkills } = await assertOwnsProgram(validatedProgramId, membership.companyId);
  if (program.status === "completed") throw new Error("This program is already completed.");

  const db = getDb();
  const weeks = await db
    .select()
    .from(schema.internshipWeeks)
    .where(eq(schema.internshipWeeks.programId, program.id));
  const weekIds = weeks.map((w) => w.id);

  const doneTasks = weekIds.length
    ? await db
        .select({ title: schema.internshipTasks.title })
        .from(schema.internshipTasks)
        .where(and(inArray(schema.internshipTasks.weekId, weekIds), eq(schema.internshipTasks.status, "done")))
    : [];

  const workCompleted = doneTasks.length > 0 ? doneTasks.map((t) => t.title) : weeks.map((w) => w.title);

  await db
    .update(schema.internshipPrograms)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(schema.internshipPrograms.id, program.id));

  const [record] = await db
    .insert(schema.verifiedExperience)
    .values({
      programId: program.id,
      workCompleted,
      skillsDemonstrated: opportunitySkills,
      supervisorVerified: true,
      verifiedAt: new Date(),
    })
    .returning();

  await db.insert(schema.eventLog).values({
    entityType: "internship_program",
    entityId: program.id,
    eventType: "internship_program_completed",
    actorUserId: user.id,
  });

  return record.id as string;
}
