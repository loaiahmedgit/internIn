import { describe, it, expect } from "vitest";
import { computeProgramProgress } from "./program-progress";

const program = { createdAt: new Date("2026-01-01T00:00:00Z"), durationWeeks: 8 };

describe("computeProgramProgress", () => {
  it("is not started when no tasks are done yet", () => {
    const weeks = [{ id: "w1", weekNumber: 1, title: "Onboarding" }];
    const tasks = [{ weekId: "w1", status: "pending" as const }];
    const result = computeProgramProgress(program, weeks, tasks, new Date("2026-01-01T12:00:00Z"));
    expect(result.statusLabel).toBe("Not started");
    expect(result.behindSchedule).toBe(false);
  });

  it("is on track when completed weeks keep pace with elapsed time", () => {
    const weeks = [
      { id: "w1", weekNumber: 1, title: "Onboarding" },
      { id: "w2", weekNumber: 2, title: "Sales funnel analysis" },
    ];
    const tasks = [
      { weekId: "w1", status: "done" as const },
      { weekId: "w2", status: "in_progress" as const },
    ];
    // 8 days later = 1 elapsed week -> expected week 2, week 1 fully done -> on track
    const result = computeProgramProgress(program, weeks, tasks, new Date("2026-01-09T00:00:00Z"));
    expect(result.statusLabel).toBe("On track");
    expect(result.currentWeekNumber).toBe(2);
    expect(result.tasksDone).toBe(1);
    expect(result.tasksTotal).toBe(2);
  });

  it("flags behind schedule when elapsed weeks outpace completed weeks", () => {
    const weeks = [
      { id: "w1", weekNumber: 1, title: "Onboarding" },
      { id: "w2", weekNumber: 2, title: "Sales funnel analysis" },
      { id: "w3", weekNumber: 3, title: "Report" },
    ];
    const tasks = [
      { weekId: "w1", status: "done" as const },
      { weekId: "w2", status: "pending" as const },
      { weekId: "w3", status: "pending" as const },
    ];
    // 3 weeks later, only week 1 complete -> behind
    const result = computeProgramProgress(program, weeks, tasks, new Date("2026-01-22T00:00:00Z"));
    expect(result.statusLabel).toBe("Behind schedule");
    expect(result.behindSchedule).toBe(true);
  });

  it("never reports behind schedule past the program's final week", () => {
    const weeks = [{ id: "w1", weekNumber: 1, title: "Onboarding" }];
    const tasks = [{ weekId: "w1", status: "done" as const }];
    const shortProgram = { createdAt: new Date("2026-01-01T00:00:00Z"), durationWeeks: 1 };
    const result = computeProgramProgress(shortProgram, weeks, tasks, new Date("2026-06-01T00:00:00Z"));
    expect(result.behindSchedule).toBe(false);
  });
});
