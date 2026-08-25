import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Sparkles, CheckCircle2, Send } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="mx-auto grid max-w-6xl gap-16 px-6 pb-24 pt-20 lg:grid-cols-2 lg:items-center lg:pb-32 lg:pt-28">
        <div>
          <h1 className="text-balance text-4xl font-bold leading-[1.1] tracking-tight text-navy sm:text-5xl lg:text-[3.4rem]">
            Experience shouldn&apos;t be required to earn experience.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-navy/70">
            internIn lets students prove what they can do through realistic company work
            challenges — so companies can choose interns based on evidence, not just CVs.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button render={<Link href="/#for-students" />} nativeButton={false} size="lg" className="bg-teal text-white hover:bg-teal/90">
              Find internships <ArrowRight className="ml-1 size-4" />
            </Button>
            <Button
              render={<Link href="/company/opportunities/new" />} nativeButton={false}
              size="lg"
              variant="outline"
              className="border-navy/20 text-navy hover:bg-gray-light"
            >
              Hire interns
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-xl border border-gray-cool/60 bg-white shadow-[0_1px_2px_rgba(33,50,72,0.06),0_12px_32px_-8px_rgba(33,50,72,0.18)]">
            <div className="flex items-center justify-between border-b border-gray-cool/50 bg-gray-light/60 px-5 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-navy/50">
                Data Analyst Intern
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal">
                <span className="size-1.5 rounded-full bg-teal" /> Active
              </span>
            </div>
            <div className="space-y-4 p-5">
              <div className="flex items-start gap-3 rounded-lg border border-gray-cool/50 p-3">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-teal" />
                <div>
                  <p className="text-sm font-medium text-navy">Complete work challenge</p>
                  <p className="text-xs text-navy/50">Sales performance analysis · 75 min</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-gray-cool/50 p-3">
                <FileText className="mt-0.5 size-4 shrink-0 text-navy/40" />
                <div>
                  <p className="text-sm font-medium text-navy">Performance reviewed</p>
                  <p className="text-xs text-navy/50">4/5 insights found · dashboard submitted</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-teal/30 bg-teal/5 p-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal" />
                <div>
                  <p className="text-sm font-medium text-navy">Invited to internship</p>
                  <p className="text-xs text-navy/50">Offer sent · program generated</p>
                </div>
              </div>
            </div>
          </div>
          <div aria-hidden className="absolute -right-6 -top-6 -z-10 size-40 rounded-full bg-teal/5 blur-2xl" />
        </div>
      </div>
    </section>
  );
}

export function ParadoxSection() {
  return (
    <section className="border-y border-gray-cool/50 bg-gray-light/50">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="max-w-2xl text-balance text-2xl font-bold tracking-tight text-navy sm:text-3xl">
          How do you get experience when every opportunity requires experience?
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-cool/60 bg-white p-7">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">
              Traditional hiring
            </p>
            <ul className="mt-4 space-y-3 text-navy/70">
              {["CV", "Past experience", "GPA", "Connections", "Interview"].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm">
                  <span className="size-1 rounded-full bg-navy/30" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-teal/30 bg-white p-7 ring-1 ring-teal/10">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal">internIn</p>
            <ul className="mt-4 space-y-3 text-navy/80">
              {[
                "Real challenge",
                "Actual work",
                "Evidence",
                "Company review",
                "Opportunity",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm font-medium">
                  <Send className="size-3.5 text-teal" /> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
