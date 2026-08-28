/**
 * Derives an honest progress signal for an internship program from real
 * columns only — there is no due-date, milestone, or check-in schedule in
 * the schema (internship_weeks/internship_tasks carry no dates). Severity
 * compares wall-clock weeks elapsed since the program was created against
 * the highest week whose tasks are all done, rather than inventing a
 * blocker/check-in field that doesn't exist yet. Two thresholds (1 week
 * behind vs 2+) give the "needs attention" vs "behind schedule" distinction
 * the UI wants, using the same real numbers at different sensitivity.
 */

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export type ProgramSeverity = "not_started" | "on_track" | "needs_attention" | "behind_schedule" | "completed";

export interface ProgramWeekInput {
  id: string;
  weekNumber: number;
  title: string;
}

export interface ProgramTaskInput {
  weekId: string;
  status: "pending" | "in_progress" | "done";
}

export interface ProgramProgress {
  currentWeekNumber: number;
  currentWeekTitle: string;
  tasksDone: number;
  tasksTotal: number;
  /** expectedWeekNumber - (highestCompletedWeekNumber + 1), clamped to >= 0 */
  gapWeeks: number;
  severity: Exclude<ProgramSeverity, "completed">;
}

export function computeProgramProgress(
  program: { createdAt: Date; durationWeeks: number },
  weeks: ProgramWeekInput[],
  tasks: ProgramTaskInput[],
  now: Date = new Date(),
): ProgramProgress {
  const sortedWeeks = [...weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  const tasksByWeek = new Map<string, ProgramTaskInput[]>();
  for (const task of tasks) {
    tasksByWeek.set(task.weekId, [...(tasksByWeek.get(task.weekId) ?? []), task]);
  }

  const tasksTotal = tasks.length;
  const tasksDone = tasks.filter((t) => t.status === "done").length;

  let highestCompletedWeekNumber = 0;
  for (const week of sortedWeeks) {
    const weekTasks = tasksByWeek.get(week.id) ?? [];
    if (weekTasks.length > 0 && weekTasks.every((t) => t.status === "done")) {
      highestCompletedWeekNumber = week.weekNumber;
    }
  }

  const currentWeek =
    sortedWeeks.find((w) => w.weekNumber === highestCompletedWeekNumber + 1) ??
    sortedWeeks[sortedWeeks.length - 1];

  const elapsedWeeks = Math.max(0, Math.floor((now.getTime() - program.createdAt.getTime()) / MS_PER_WEEK));
  const expectedWeekNumber = Math.min(elapsedWeeks + 1, program.durationWeeks);
  const gapWeeks = tasksTotal > 0 ? Math.max(0, expectedWeekNumber - (highestCompletedWeekNumber + 1)) : 0;

  let severity: ProgramProgress["severity"];
  if (tasksDone === 0 && gapWeeks === 0) severity = "not_started";
  else if (gapWeeks === 0) severity = "on_track";
  else if (gapWeeks === 1) severity = "needs_attention";
  else severity = "behind_schedule";

  return {
    currentWeekNumber: currentWeek?.weekNumber ?? 1,
    currentWeekTitle: currentWeek?.title ?? "",
    tasksDone,
    tasksTotal,
    gapWeeks,
    severity,
  };
}
