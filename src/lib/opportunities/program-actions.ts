"use server";

import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { hasPermission } from "@/lib/company/permissions";
import { sendNotificationEvent } from "@/lib/inngest/client";
import { eq, and, asc, inArray } from "drizzle-orm";
import { z } from "zod";

const IdSchema = z.string().uuid();

/**
 * Phase 6A hardening — the real gap: `program_supervisor` was a
 * company-wide permission, so any holder could act on ANY program in the
 * company, not just ones they're assigned to. This is the one canonical
 * check for "can this member supervise THIS specific program" —
 * workspace_admin bypasses it (explicit, deliberate HR/admin override,
 * matching permissions.ts's own documented design and this repo's
 * existing hasPermission short-circuit); every other program_supervisor
 * holder needs a real program_supervisor_assignments row for this exact
 * program. There is no read/write split in the product yet, so this one
 * check backs both viewing a program page and performing a supervisor
 * action on it — see requireProgramViewer/requireProgramSupervisor below.
 */
export async function assertAssignedOrAdmin(programId: string, membership: { id: string; role: string; permissions: string[] | null }) {
  if (hasPermission(membership, "workspace_admin")) return;
  const db = getDb();
  const [assignment] = await db
    .select({ id: schema.programSupervisorAssignments.id })
    .from(schema.programSupervisorAssignments)
    .where(and(eq(schema.programSupervisorAssignments.programId, programId), eq(schema.programSupervisorAssignments.companyMemberId, membership.id)))
    .limit(1);
  if (!assignment) throw new Error("You're not assigned as a supervisor for this program. Ask a workspace administrator to assign you.");
}

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
    .select({ task: schema.internshipTasks, programId: schema.internshipWeeks.programId, opportunityCompanyId: schema.opportunities.companyId })
    .from(schema.internshipTasks)
    .innerJoin(schema.internshipWeeks, eq(schema.internshipTasks.weekId, schema.internshipWeeks.id))
    .innerJoin(schema.internshipPrograms, eq(schema.internshipWeeks.programId, schema.internshipPrograms.id))
    .innerJoin(schema.internshipOffers, eq(schema.internshipPrograms.offerId, schema.internshipOffers.id))
    .innerJoin(schema.applications, eq(schema.internshipOffers.applicationId, schema.applications.id))
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .where(eq(schema.internshipTasks.id, taskId))
    .limit(1);
  if (!row || row.opportunityCompanyId !== companyId) throw new Error("Not authorized for this task.");
  return { ...row.task, programId: row.programId };
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

/**
 * Same rule as assertAssignedOrAdmin, exported for the program pages to
 * call directly — viewing a program page and acting as its supervisor
 * require identical access in v1 (no separate broader "read-only HR
 * overview" exists in the product yet, per §14's own "do not overabstract
 * if the repo already has an established pattern"). Both names resolve to
 * one implementation on purpose, not two independently maintained ones —
 * named separately so a future phase can loosen read without touching
 * every write call site.
 */
export async function requireProgramViewer(programId: string) {
  const { user, membership } = await requireCurrentCompanyMember("program_supervisor");
  const row = await assertOwnsProgram(programId, membership.companyId);
  await assertAssignedOrAdmin(programId, membership);
  return { user, membership, ...row };
}
export const requireProgramSupervisor = requireProgramViewer;

const TaskTitleSchema = z.string().trim().min(1).max(160);
const TaskDescriptionSchema = z.string().trim().max(2000);
const TaskStatusSchema = z.enum(["pending", "in_progress", "blocked", "done"]);
const FeedbackSchema = z.string().trim().min(1).max(4000);

export async function addInternshipTaskAction(weekId: string, title: string, description?: string) {
  const validatedWeekId = IdSchema.parse(weekId);
  const validatedTitle = TaskTitleSchema.parse(title);
  const validatedDescription = description ? TaskDescriptionSchema.parse(description) : undefined;
  const { user, membership } = await requireCurrentCompanyMember("program_supervisor");
  const week = await assertOwnsWeek(validatedWeekId, membership.companyId);
  await assertAssignedOrAdmin(week.programId, membership);

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

export async function updateInternshipTaskStatusAction(taskId: string, status: "pending" | "in_progress" | "blocked" | "done") {
  const validatedTaskId = IdSchema.parse(taskId);
  const validatedStatus = TaskStatusSchema.parse(status);
  const { user, membership } = await requireCurrentCompanyMember("program_supervisor");
  const task = await assertOwnsTask(validatedTaskId, membership.companyId);
  await assertAssignedOrAdmin(task.programId, membership);

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
  await assertAssignedOrAdmin(program.id, membership);
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

  await sendNotificationEvent({
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
  await assertAssignedOrAdmin(program.id, membership);
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

/**
 * Real company members eligible to supervise this program — real
 * membership rows holding program_supervisor, never an invented list —
 * plus who's already assigned. Backs the assign-supervisor selector; the
 * caller must already be able to view the program (workspace_admin or an
 * existing assignee), same as every other program read here.
 */
export async function getEligibleProgramSupervisorsAction(programId: string) {
  const validatedProgramId = IdSchema.parse(programId);
  const { membership } = await requireProgramViewer(validatedProgramId);
  const db = getDb();

  const memberRows = await db
    .select({
      id: schema.companyMembers.id,
      role: schema.companyMembers.role,
      permissions: schema.companyMembers.permissions,
      name: schema.users.fullName,
      email: schema.users.email,
    })
    .from(schema.companyMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.companyMembers.userId))
    .where(eq(schema.companyMembers.companyId, membership.companyId));
  // Every member, name/email only — client cross-references this against
  // `assigned` for display and `eligible` to build the add-supervisor
  // options (never selectable: cross-company, no permission, per §10).
  const members = memberRows.map((m) => ({ id: m.id, name: m.name, email: m.email, eligible: hasPermission(m, "program_supervisor") }));

  const assigned = await db
    .select({ companyMemberId: schema.programSupervisorAssignments.companyMemberId, isPrimary: schema.programSupervisorAssignments.isPrimary })
    .from(schema.programSupervisorAssignments)
    .where(eq(schema.programSupervisorAssignments.programId, validatedProgramId));

  return { members, assigned };
}

const CompanyMemberSelectShape = { id: schema.companyMembers.id, role: schema.companyMembers.role, permissions: schema.companyMembers.permissions, companyId: schema.companyMembers.companyId };

/**
 * Assigns (or updates) one company member as a supervisor for this
 * program — idempotent (an existing row is updated, never duplicated;
 * the unique index backs this too). Who may change assignments: an
 * existing assignee, or workspace_admin — same rule as every supervisor
 * action here (§3/§21), so nobody can hand themselves access to a program
 * they were never on.
 */
export async function assignProgramSupervisorAction(programId: string, companyMemberId: string, makePrimary = false) {
  const validatedProgramId = IdSchema.parse(programId);
  const validatedMemberId = IdSchema.parse(companyMemberId);
  const { user, membership } = await requireCurrentCompanyMember("program_supervisor");
  const { program } = await assertOwnsProgram(validatedProgramId, membership.companyId);
  await assertAssignedOrAdmin(program.id, membership);

  const db = getDb();
  const [targetMember] = await db.select(CompanyMemberSelectShape).from(schema.companyMembers).where(eq(schema.companyMembers.id, validatedMemberId)).limit(1);
  if (!targetMember || targetMember.companyId !== membership.companyId) throw new Error("That member isn't part of this company.");
  if (!hasPermission(targetMember, "program_supervisor")) throw new Error("That member doesn't have Program Supervisor access.");

  const [existing] = await db
    .select({ id: schema.programSupervisorAssignments.id })
    .from(schema.programSupervisorAssignments)
    .where(and(eq(schema.programSupervisorAssignments.programId, program.id), eq(schema.programSupervisorAssignments.companyMemberId, validatedMemberId)))
    .limit(1);

  if (makePrimary) {
    // At most one primary per program (partial unique index) — clear any
    // existing primary in the same transaction as setting the new one.
    await db.transaction(async (tx) => {
      await tx
        .update(schema.programSupervisorAssignments)
        .set({ isPrimary: false })
        .where(and(eq(schema.programSupervisorAssignments.programId, program.id), eq(schema.programSupervisorAssignments.isPrimary, true)));
      if (existing) {
        await tx.update(schema.programSupervisorAssignments).set({ isPrimary: true }).where(eq(schema.programSupervisorAssignments.id, existing.id));
      } else {
        await tx.insert(schema.programSupervisorAssignments).values({ programId: program.id, companyMemberId: validatedMemberId, isPrimary: true, assignedByUserId: user.id });
      }
    });
  } else if (!existing) {
    await db.insert(schema.programSupervisorAssignments).values({ programId: program.id, companyMemberId: validatedMemberId, assignedByUserId: user.id });
  }

  await db.insert(schema.eventLog).values({
    entityType: "internship_program",
    entityId: program.id,
    eventType: existing ? "program_supervisor_reassigned" : "program_supervisor_assigned",
    actorUserId: user.id,
    metadata: { companyMemberId: validatedMemberId, isPrimary: makePrimary },
  });
}

/**
 * Removes one supervisor's access to this program — the program itself,
 * its tasks/weeks/feedback/history, and the student's membership are
 * never touched (§22). If that leaves the program with no assignee at
 * all, it honestly becomes "Needs supervisor" (page-level display) rather
 * than a fake auto-replacement.
 */
export async function removeProgramSupervisorAction(programId: string, companyMemberId: string) {
  const validatedProgramId = IdSchema.parse(programId);
  const validatedMemberId = IdSchema.parse(companyMemberId);
  const { user, membership } = await requireCurrentCompanyMember("program_supervisor");
  const { program } = await assertOwnsProgram(validatedProgramId, membership.companyId);
  await assertAssignedOrAdmin(program.id, membership);

  const db = getDb();
  const [removed] = await db
    .select({ isPrimary: schema.programSupervisorAssignments.isPrimary })
    .from(schema.programSupervisorAssignments)
    .where(and(eq(schema.programSupervisorAssignments.programId, program.id), eq(schema.programSupervisorAssignments.companyMemberId, validatedMemberId)))
    .limit(1);

  await db
    .delete(schema.programSupervisorAssignments)
    .where(and(eq(schema.programSupervisorAssignments.programId, program.id), eq(schema.programSupervisorAssignments.companyMemberId, validatedMemberId)));

  // Reproduced live during Phase 6A QA: removing the primary left a real,
  // still-assigned co-supervisor un-promoted — student-facing display
  // (which reads isPrimary only) wrongly said "Not yet assigned" even
  // though someone genuinely still had full access. If a co-supervisor
  // remains, one of them becomes primary; if none remain, this is the
  // real "Needs supervisor" case (§22) and nothing is promoted.
  if (removed?.isPrimary) {
    const [nextPrimary] = await db
      .select({ id: schema.programSupervisorAssignments.id })
      .from(schema.programSupervisorAssignments)
      .where(eq(schema.programSupervisorAssignments.programId, program.id))
      .orderBy(asc(schema.programSupervisorAssignments.createdAt))
      .limit(1);
    if (nextPrimary) {
      await db.update(schema.programSupervisorAssignments).set({ isPrimary: true }).where(eq(schema.programSupervisorAssignments.id, nextPrimary.id));
    }
  }

  await db.insert(schema.eventLog).values({
    entityType: "internship_program",
    entityId: program.id,
    eventType: "program_supervisor_removed",
    actorUserId: user.id,
    metadata: { companyMemberId: validatedMemberId },
  });
}
