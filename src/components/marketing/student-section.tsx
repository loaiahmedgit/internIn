import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function ForStudentsSection() {
  return (
    <section id="for-students" className="border-y border-gray-cool/50 bg-gray-light/50">
      <div className="mx-auto max-w-6xl px-6 py-24 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal">For students</p>
        <h2 className="mx-auto mt-3 max-w-2xl text-balance text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          Don&apos;t tell them what you can do. Show them.
        </h2>
        <div className="mx-auto mt-10 grid max-w-3xl gap-6 text-left sm:grid-cols-2">
          {[
            "Browse opportunities",
            "Complete realistic challenges",
            "Get discovered based on your work",
            "Earn verified experience",
          ].map((step, i) => (
            <div key={step} className="flex items-start gap-3 rounded-lg bg-white p-4 border border-gray-cool/60">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-teal/10 text-xs font-semibold text-teal">
                {i + 1}
              </span>
              <span className="text-sm font-medium text-navy">{step}</span>
            </div>
          ))}
        </div>
        <Button render={<Link href="/company/opportunities/new" />} nativeButton={false} size="lg" className="mt-10 bg-teal text-white hover:bg-teal/90">
          Explore opportunities <ArrowRight className="ml-1 size-4" />
        </Button>
      </div>
    </section>
  );
}

const candidates = [
  {
    name: "Ahmed",
    completed: "5/6 tasks",
    time: "71 min",
    strength: "Noticed the regional sales anomaly most submissions missed",
  },
  {
    name: "Sara",
    completed: "6/6 tasks",
    time: "93 min",
    strength: "Clearest dashboard and presentation of the three",
  },
  {
    name: "Noor",
    completed: "5/6 tasks",
    time: "62 min",
    strength: "Fastest completion with solid technical execution",
  },
];

export function CandidateEvidenceSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal">Candidate evidence</p>
        <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          See how they actually performed.
        </h2>
      </div>
      <div className="mt-12 grid gap-5 sm:grid-cols-3">
        {candidates.map((c) => (
          <div key={c.name} className="rounded-xl border border-gray-cool/60 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-navy">{c.name}</p>
              <span className="text-xs text-navy/50">{c.time}</span>
            </div>
            <p className="mt-1 text-xs font-medium text-teal">{c.completed} completed</p>
            <p className="mt-3 text-sm leading-relaxed text-navy/70">{c.strength}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
