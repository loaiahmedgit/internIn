import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

export function ForCompaniesSection() {
  return (
    <section id="for-companies" className="mx-auto max-w-6xl px-6 py-24">
      <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal">For companies</p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-navy sm:text-4xl">
            From role to realistic assessment in minutes.
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-navy/70">
            Describe what your intern will actually do. internIn turns it into a realistic,
            safe work challenge — built on synthetic data, never your real company data.
          </p>
          <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-gray-cool/60 bg-gray-light/50 p-4">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal" />
            <p className="text-sm text-navy/70">
              Your internal systems stay private — every challenge runs on synthetic datasets,
              fictional customers, and sanitized scenarios.
            </p>
          </div>
          <Button render={<Link href="/company/opportunities/new" />} nativeButton={false} size="lg" className="mt-8 bg-teal text-white hover:bg-teal/90">
            Try the AI Challenge Builder <ArrowRight className="ml-1 size-4" />
          </Button>
        </div>

        <div className="rounded-xl border border-gray-cool/60 bg-white p-6 shadow-[0_1px_2px_rgba(33,50,72,0.06),0_16px_40px_-12px_rgba(33,50,72,0.16)]">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-navy/40">
            <Sparkles className="size-3.5 text-teal" /> Build with AI
          </div>
          <div className="space-y-3">
            <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-gray-light px-3.5 py-2.5 text-sm text-navy">
              We&apos;re looking for a marketing intern who can handle campaign analysis and
              competitor research.
            </div>
            <div className="max-w-[85%] rounded-lg rounded-tl-sm border border-teal/25 bg-teal/5 px-3.5 py-2.5 text-sm text-navy">
              Got it. What would a strong submission actually include — a written brief, a
              deck, or something else?
            </div>
            <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-gray-light px-3.5 py-2.5 text-sm text-navy">
              A one-page campaign brief with messaging and a simple plan.
            </div>
            <div className="rounded-lg border border-gray-cool/50 bg-white p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">
                Generated challenge
              </p>
              <p className="mt-1.5 text-sm font-medium text-navy">
                Marketing Campaign Challenge
              </p>
              <p className="mt-1 text-xs text-navy/50">
                Fictional brand launch · synthetic competitor data · ~75 min
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
