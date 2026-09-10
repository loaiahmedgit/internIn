import { ASSESSMENT_PATTERNS, type AssessmentPlan } from "@/lib/challenges/architect";

export function AssessmentPlanSummary({ plan }: { plan: AssessmentPlan | null | undefined }) {
  if (!plan) return null;
  const unassessed = ASSESSMENT_PATTERNS.filter((pattern) => !plan.foundations.some((item) => item.pattern === pattern));
  return <section className="space-y-4 rounded-xl border border-gray-cool bg-white p-5" aria-label="What this Challenge assesses">
    <div><h2 className="font-semibold text-navy">What this Challenge can show</h2><p className="mt-1 text-sm text-navy/60">A plan for collecting evidence, with human review still required.</p></div>
    {plan.foundations.map((item, index) => <div key={`${item.foundation}-${index}`} className="border-t border-gray-cool/60 pt-3 text-sm">
      <h3 className="font-medium">{item.foundation} <span className="font-normal text-navy/50">· {item.importance}</span></h3>
      <p className="mt-1">{item.candidateAction}</p><p className="mt-1 text-navy/65">Evidence: {item.evidence}</p><p className="mt-1 text-navy/65">Human review: {item.humanReview}</p>
    </div>)}
    <div className="text-sm"><h3 className="font-medium">What it cannot establish</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-navy/65">{plan.cannotEstablish.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
    {plan.practicalVerificationRequired.length > 0 && <p className="text-sm text-navy/65">Practical verification required: {plan.practicalVerificationRequired.join("; ")}</p>}
    {plan.willTeach.length > 0 && <p className="text-sm text-navy/65">The team will teach: {plan.willTeach.join("; ")}</p>}
    <p className="text-xs text-navy/50">Patterns not assessed: {unassessed.map((pattern) => pattern.replaceAll("_", " ")).join(", ") || "None outside the selected plan"}.</p>
    {plan.completionWindowHours && <p className="text-xs text-navy/50">Suggested completion window: {plan.completionWindowHours} hours. Estimated active work: {plan.activeMinutes} minutes. The window is guidance, not an automatic cutoff.</p>}
  </section>;
}
