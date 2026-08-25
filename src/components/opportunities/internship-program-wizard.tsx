"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateInternshipProgramAction } from "@/lib/ai/actions";
import { createInternshipProgramAction } from "@/lib/opportunities/actions";
import type { InternshipProgram } from "@/lib/ai";

export function InternshipProgramWizard({
  offerId,
  internName,
  role,
  defaultHoursPerWeek,
}: {
  offerId: string;
  internName: string;
  role: string;
  defaultHoursPerWeek: number;
}) {
  const router = useRouter();
  const [durationWeeks, setDurationWeeks] = useState(8);
  const [hoursPerWeek, setHoursPerWeek] = useState(defaultHoursPerWeek);
  const [goals, setGoals] = useState("");
  const [program, setProgram] = useState<InternshipProgram | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await generateInternshipProgramAction({
          internName,
          role,
          durationWeeks,
          hoursPerWeek,
          goals,
        });
        setProgram(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't generate a plan. Try again.");
      }
    });
  }

  function updateWeek(index: number, field: "title" | "objectives", value: string) {
    if (!program) return;
    const weeks = [...program.weeks];
    weeks[index] = {
      ...weeks[index],
      [field]: field === "objectives" ? value.split("\n").filter((l) => l.trim().length > 0) : value,
    };
    setProgram({ ...program, weeks });
  }

  function handleCreate() {
    if (!program) return;
    setError(null);
    startTransition(async () => {
      try {
        await createInternshipProgramAction(offerId, program);
        router.push(`/company/offers/${offerId}/program`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't create the program. Try again.");
      }
    });
  }

  if (!program) {
    return (
      <div className="mt-8 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="duration-weeks" className="text-sm font-medium text-navy">
              Duration (weeks)
            </label>
            <Input
              id="duration-weeks"
              type="number"
              min={1}
              max={52}
              value={durationWeeks}
              onChange={(e) => setDurationWeeks(Number(e.target.value))}
              className="mt-1.5"
            />
          </div>
          <div>
            <label htmlFor="hours-per-week" className="text-sm font-medium text-navy">
              Hours per week
            </label>
            <Input
              id="hours-per-week"
              type="number"
              min={1}
              max={60}
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(Number(e.target.value))}
              className="mt-1.5"
            />
          </div>
        </div>
        <div>
          <label htmlFor="program-goals" className="text-sm font-medium text-navy">
            What should {internName} learn and work on?
          </label>
          <Textarea
            id="program-goals"
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            rows={5}
            placeholder="e.g. Learn our product, understand competitors, work with campaign analytics, contribute to a real campaign."
            className="mt-1.5"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleGenerate} disabled={isPending || goals.trim().length < 20}>
          {isPending ? "Generating…" : "Generate plan"}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      <p className="text-sm text-navy/60">Review and edit the plan before creating it. AI proposes — you control it.</p>
      {program.weeks.map((week, i) => (
        <div key={week.week} className="border border-navy/12 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">Week {week.week}</p>
          <Input
            value={week.title}
            onChange={(e) => updateWeek(i, "title", e.target.value)}
            className="mt-1.5 font-medium"
            aria-label={`Week ${week.week} title`}
          />
          <Textarea
            value={week.objectives.join("\n")}
            onChange={(e) => updateWeek(i, "objectives", e.target.value)}
            rows={3}
            className="mt-2 text-sm"
            aria-label={`Week ${week.week} objectives`}
          />
        </div>
      ))}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setProgram(null)} disabled={isPending}>
          Back
        </Button>
        <Button onClick={handleCreate} disabled={isPending} className="bg-teal text-white hover:bg-teal/90">
          {isPending ? "Creating…" : "Create program"}
        </Button>
      </div>
    </div>
  );
}
