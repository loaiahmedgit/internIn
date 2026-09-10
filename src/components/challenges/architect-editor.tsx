"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Challenge } from "@/lib/ai/schemas";
import { ASSESSMENT_PATTERNS, emptyAssessmentPlan, emptyRoleReality, nextArchitectQuestions, involvesDirectCare, type AssessmentPlan } from "@/lib/challenges/architect";
import { understandRoleAction, designAssessmentPlanAction } from "@/lib/challenges/architect-actions";

const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);

function LinesInput({ value, onCommit, placeholder }: { value: string[]; onCommit: (next: string[]) => void; placeholder?: string }) {
  const text = value.join("\n");
  return <Textarea key={text} rows={3} defaultValue={text} placeholder={placeholder} onBlur={(event) => onCommit(lines(event.target.value))} />;
}

export function ArchitectEditor({ challenge, onChange }: { challenge: Challenge; onChange: (next: Challenge) => void }) {
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reality = challenge.roleReality ?? emptyRoleReality();
  const plan = challenge.assessmentPlan ?? emptyAssessmentPlan(challenge.estimatedMinutes);
  const missing = nextArchitectQuestions(reality);
  function updatePlan(patch: Partial<AssessmentPlan>) { onChange({ ...challenge, assessmentPlan: { ...plan, ...patch, activeMinutes: challenge.estimatedMinutes } }); }
  function updateFoundation(index: number, patch: Partial<AssessmentPlan["foundations"][number]>) {
    updatePlan({ foundations: plan.foundations.map((item, i) => i === index ? { ...item, ...patch } : item) });
  }
  async function assist(mode: "understand" | "plan") {
    setError(null); setPending(true);
    try {
      if (mode === "understand") onChange({ ...challenge, roleReality: await understandRoleAction(description, reality), assessmentPlan: null });
      else onChange({ ...challenge, assessmentPlan: await designAssessmentPlanAction({ reality, tasks: challenge.tasks, activeMinutes: challenge.estimatedMinutes }) });
    } catch { setError("AI assistance could not finish. Your work is kept; complete or edit the fields below, or try again."); }
    finally { setPending(false); }
  }
  return <section className="space-y-5 rounded-xl border border-gray-cool bg-white p-5" aria-label="Assessment design">
    <div><h3 className="font-semibold text-navy">What should this Challenge show?</h3><p className="mt-1 text-sm text-navy/60">Start with the actual work. Assess entry foundations and keep what your team will teach separate.</p></div>
    <label className="block space-y-2 text-sm font-medium">Describe the work in your own words
      <Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={6000} placeholder="What does this intern do, what should they already know, and what will you teach them? Include one realistic example if you can." rows={3} />
    </label>
    <Button type="button" variant="outline" disabled={pending || description.trim().length < 20} onClick={() => assist("understand")}>{pending ? "Working…" : "Organize my description"}</Button>
    {missing.length > 0 && <p className="text-sm text-navy/60">Still needed: {missing.map((item) => item.question).join(" ")}</p>}
    {/* Three essential facts are editable directly. The remaining internal
        fields are optional details, never a compulsory 15-question survey. */}
    {([
      ["actualWork", "Actual work"], ["expectedBeforeJoining", "Expected before joining"], ["willTeach", "Your team will teach"],
    ] as const).map(([field, label]) => <label key={field} className="block space-y-2 text-sm font-medium">{label}<Textarea value={reality[field] ?? ""} maxLength={700} rows={2} onChange={(event) => onChange({ ...challenge, roleReality: { ...reality, [field]: event.target.value || null } })} /></label>)}
    {involvesDirectCare(reality) && <p className="rounded-lg border border-gray-cool p-3 text-sm text-navy/70">Use fully fictional written scenarios and supplied company-approved procedures. Never request real patient data, prescriptions or credentials, or practical experimentation. Physical caregiving is not digitally assessed and must be listed below for supervised practical verification.</p>}
    <details className="text-sm"><summary className="cursor-pointer font-medium">Example, constraints and other context</summary><div className="mt-3 space-y-3">
      {([
        ["realisticExample", "One realistic example"], ["expectedOutput", "Expected output"], ["qualityCriteria", "What good work looks like"], ["concerningMistakes", "Concerning mistakes"], ["resourcesAndTools", "Resources and tools"], ["constraints", "Rules, deadlines or budgets"], ["authorityAndEscalation", "Authority and escalation"], ["changingConditions", "What changes or goes wrong"], ["tradeOffs", "Competing priorities"], ["physicalSafetyAndConfidentiality", "Physical work, safety and confidentiality"], ["teamAiUse", "How the team uses AI"], ["evidenceToTrust", "Evidence you would need to see"],
      ] as const).map(([field, label]) => <label key={field} className="block space-y-1">{label}<Textarea rows={2} maxLength={700} value={reality[field] ?? ""} onChange={(event) => onChange({ ...challenge, roleReality: { ...reality, [field]: event.target.value || null } })} /></label>)}
    </div></details>
    <div className="border-t border-gray-cool pt-4"><h4 className="font-medium">Plan the evidence</h4><p className="mt-1 text-sm text-navy/60">Use a small number of relevant foundations. AI proposals need your review; every field is editable without AI.</p></div>
    <Button type="button" variant="outline" disabled={pending || !reality.actualWork || !reality.expectedBeforeJoining || !reality.willTeach} onClick={() => assist("plan")}>Suggest an assessment plan</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <label className="block space-y-2 text-sm font-medium">Entry foundations, one per line<LinesInput value={plan.expectedBeforeJoining} onCommit={(value) => updatePlan({ expectedBeforeJoining: value })} placeholder="Only foundations the employer expects before joining" /></label>
    <label className="block space-y-2 text-sm font-medium">Taught during the internship, one per line<LinesInput value={plan.willTeach} onCommit={(value) => updatePlan({ willTeach: value })} /></label>
    {plan.foundations.map((item, index) => <fieldset key={index} className="space-y-3 rounded-lg border border-gray-cool p-4">
      <legend className="px-1 text-sm font-medium">Foundation {index + 1}</legend>
      <label className="block space-y-1 text-sm">Entry foundation<select className="h-10 w-full rounded-md border border-gray-cool bg-white px-3" value={item.foundation} onChange={(event) => updateFoundation(index, { foundation: event.target.value })}><option value="">Select an entry foundation</option>{plan.expectedBeforeJoining.map((foundation) => <option key={foundation}>{foundation}</option>)}</select></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm">Candidate behavior<select className="h-10 w-full rounded-md border border-gray-cool bg-white px-3" value={item.pattern} onChange={(event) => updateFoundation(index, { pattern: event.target.value as typeof item.pattern })}>{ASSESSMENT_PATTERNS.map((pattern) => <option key={pattern} value={pattern}>{pattern.replaceAll("_", " ")}</option>)}</select></label>
        <label className="space-y-1 text-sm">Importance<select className="h-10 w-full rounded-md border border-gray-cool bg-white px-3" value={item.importance} onChange={(event) => updateFoundation(index, { importance: event.target.value as typeof item.importance })}><option value="required">Required</option><option value="useful">Useful</option></select></label></div>
      <label className="block space-y-1 text-sm">What the candidate does<Textarea rows={2} maxLength={500} value={item.candidateAction} onChange={(event) => updateFoundation(index, { candidateAction: event.target.value })} /></label>
      <fieldset className="space-y-2 text-sm"><legend className="mb-2">Tasks that expose this foundation</legend>{challenge.tasks.map((task) => <label key={task.id} className="flex items-start gap-2"><input type="checkbox" checked={item.taskTitles.includes(task.title)} onChange={(event) => updateFoundation(index, { taskTitles: event.target.checked ? [...item.taskTitles, task.title] : item.taskTitles.filter((title) => title !== task.title) })} />{task.title}</label>)}</fieldset>
      {([ ["evidence", "Evidence produced"], ["humanReview", "What a human must inspect"], ["proposedDeterministicCheck", "Proposed factual check, if feasible (not yet executed)"] ] as const).map(([field, label]) => <label key={field} className="block space-y-1 text-sm">{label}<Textarea rows={2} maxLength={field === "proposedDeterministicCheck" ? 300 : 500} value={item[field] ?? ""} onChange={(event) => updateFoundation(index, { [field]: event.target.value || (field === "proposedDeterministicCheck" ? null : "") })} /></label>)}
      <Button type="button" variant="ghost" size="sm" onClick={() => updatePlan({ foundations: plan.foundations.filter((_, i) => i !== index) })}>Remove foundation</Button>
    </fieldset>)}
    <Button type="button" variant="outline" disabled={plan.foundations.length >= 6} onClick={() => updatePlan({ foundations: [...plan.foundations, { foundation: "", pattern: "identify", importance: "required", candidateAction: "", taskTitles: [], evidence: "", humanReview: "", proposedDeterministicCheck: null }] })}>Add foundation</Button>
    <label className="block space-y-2 text-sm font-medium">What this cannot establish, one per line<LinesInput value={plan.cannotEstablish} onCommit={(value) => updatePlan({ cannotEstablish: value })} /></label>
    <label className="block space-y-2 text-sm font-medium">Practical verification needed outside this Challenge<LinesInput value={plan.practicalVerificationRequired} onCommit={(value) => updatePlan({ practicalVerificationRequired: value })} placeholder="For example, supervised physical caregiving. Leave blank if none." /></label>
    <label className="block space-y-2 text-sm font-medium">Completion window in hours (optional)<Input type="number" min={1} max={336} value={plan.completionWindowHours ?? ""} onChange={(event) => updatePlan({ completionWindowHours: event.target.value ? Number(event.target.value) : null })} /><span className="block text-xs font-normal text-navy/60">Elapsed availability is separate from the {challenge.estimatedMinutes} minutes of active work. This is guidance, not an automatic submission cutoff.</span></label>
  </section>;
}
