import type { ApplicationEntryEvidence } from "@/lib/opportunities/application-entry";

export function ApplicationEntrySummary({ evidence }: { evidence?: ApplicationEntryEvidence | null }) {
  if (!evidence) return null;
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="font-semibold">Application work evidence</h2>
        <p className="mt-1 text-sm text-muted-foreground">Candidate responses. Human review required; these do not establish overall suitability.</p>
      </div>
      {evidence.answers.map((item, index) => (
        <div key={index} className="space-y-2">
          <h3 className="text-sm font-medium">{item.question}</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.response}</p>
        </div>
      ))}
      {evidence.eligibility.length > 0 && <p className="text-xs text-muted-foreground">At application: explicit prerequisites matched declared profile information. Documents were not independently verified.</p>}
    </section>
  );
}
