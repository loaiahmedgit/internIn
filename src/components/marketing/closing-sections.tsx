import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const weeks = [
  "Onboarding",
  "Market research",
  "Competitor analysis",
  "Campaign analytics",
  "Campaign planning",
  "Execution support",
  "Optimization",
  "Final project",
];

export function AfterHiringSection() {
  return (
    <section id="how-it-works" className="border-y border-gray-cool/50 bg-navy">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal">After hiring</p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Hiring them is only the beginning.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-white/70">
            Generate a structured internship program, track milestones, collect supervisor
            feedback, and give interns verified experience when they finish.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {weeks.map((w, i) => (
            <div key={w} className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-teal">
                Week {i + 1}
              </p>
              <p className="mt-1 text-xs font-medium text-white">{w}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PricingTeaserSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          Simple pricing.
        </h2>
      </div>
      <div className="mx-auto mt-12 grid max-w-2xl gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-cool/60 bg-white p-7">
          <p className="text-sm font-semibold text-navy">Students</p>
          <p className="mt-1 text-2xl font-bold text-navy">Free</p>
          <ul className="mt-5 space-y-2.5 text-sm text-navy/70">
            {["Explore internships", "Complete challenges", "Build verified experience"].map(
              (f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="size-3.5 text-teal" /> {f}
                </li>
              ),
            )}
          </ul>
        </div>
        <div className="rounded-xl border border-teal/30 bg-white p-7 ring-1 ring-teal/10">
          <p className="text-sm font-semibold text-navy">Companies</p>
          <p className="mt-1 text-2xl font-bold text-navy">Free to start</p>
          <p className="text-xs text-navy/50">QAR 499 when you hire an intern</p>
          <ul className="mt-5 space-y-2.5 text-sm text-navy/70">
            {["Create internships", "Generate challenges with AI", "Review candidates"].map(
              (f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="size-3.5 text-teal" /> {f}
                </li>
              ),
            )}
          </ul>
        </div>
      </div>
      <p className="mt-8 text-center">
        <Link href="/pricing" className="text-sm font-medium text-teal hover:underline">
          See full pricing details →
        </Link>
      </p>
    </section>
  );
}

export function FinalCtaSection() {
  return (
    <section className="bg-gray-light/60">
      <div className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          Give talent a way in.
        </h2>
        <div className="mx-auto mt-8 grid max-w-md gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-cool/60 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">Students</p>
            <p className="mt-1 text-sm font-medium text-navy">Prove what you can do.</p>
          </div>
          <div className="rounded-lg border border-gray-cool/60 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">Companies</p>
            <p className="mt-1 text-sm font-medium text-navy">See what they can do.</p>
          </div>
        </div>
        <Button render={<Link href="/company/opportunities/new" />} nativeButton={false} size="lg" className="mt-9 bg-teal text-white hover:bg-teal/90">
          Get started
        </Button>
      </div>
    </section>
  );
}
