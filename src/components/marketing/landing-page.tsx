import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarRange,
  Check,
  CircleCheck,
  Code2,
  Database,
  FileCheck2,
  FileSpreadsheet,
  FlaskConical,
  Landmark,
  LockKeyhole,
  Megaphone,
  PenTool,
  SearchCheck,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroThreeField } from "@/components/marketing/hero-three-field";
import { Reveal } from "@/components/marketing/reveal";
import { RoleChallengeDemo } from "@/components/marketing/role-challenge-demo";
import { LogoLoop, type LogoItem } from "@/components/ui/logo-loop";

const roleCategories: LogoItem[] = [
  { node: <RoleCategory icon={BarChart3} label="Data" />, title: "Data" },
  { node: <RoleCategory icon={Megaphone} label="Marketing" />, title: "Marketing" },
  { node: <RoleCategory icon={Landmark} label="Finance" />, title: "Finance" },
  { node: <RoleCategory icon={PenTool} label="Design" />, title: "Design" },
  { node: <RoleCategory icon={Code2} label="Engineering" />, title: "Engineering" },
  { node: <RoleCategory icon={FlaskConical} label="Research" />, title: "Research" },
];

const capabilities = [
  {
    icon: SearchCheck,
    title: "Prove ability",
    body: "Students complete work that resembles the role, not another generic application form.",
  },
  {
    icon: FileCheck2,
    title: "Review evidence",
    body: "Companies see the original submission, rubric evidence, strengths, and tradeoffs.",
  },
  {
    icon: CalendarRange,
    title: "Run the internship",
    body: "A successful hire becomes a structured program with milestones and verified experience.",
  },
];

const weeks = ["Onboard", "Research", "Analyze", "Plan", "Contribute", "Review", "Improve", "Present"];

export function LandingPage() {
  return (
    <>
      <Hero />
      <CapabilityRail />
      <EvidenceBand />
      <ProductStory />
      <PricingSection />
      <FinalCta />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      <HeroThreeField />
      <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(52%_43%_at_50%_49%,#fff_34%,rgba(255,255,255,0)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white via-white/60 to-transparent sm:h-44" />
        <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent sm:w-16" />
        <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent sm:w-16" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent sm:h-28" />
      </div>
      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-7rem)] max-w-7xl flex-col px-5 sm:px-8 lg:px-10">
        <div className="flex flex-1 flex-col items-center justify-center pt-16 text-center sm:pt-20">
          <Reveal>
            <p className="mb-6 text-xs font-medium tracking-[0.12em] text-teal-ink uppercase">
              Work-sample hiring for early careers
            </p>
            <h1 className="mx-auto text-balance text-[clamp(3rem,5.8vw,5.25rem)] font-semibold leading-[0.96] tracking-[-0.06em] text-navy">
              <span className="block lg:whitespace-nowrap">Experience should not be required</span>
              <span className="block">to earn experience.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-balance text-base leading-7 text-navy/68 sm:text-lg">
              Students prove their ability through real work. Companies hire from evidence, then run better internships.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                render={<Link href="/signup?role=student" />}
                nativeButton={false}
                className="h-11 min-w-40 rounded-full bg-teal-ink px-5 text-white hover:bg-[#0b625c]"
              >
                Find internships <ArrowRight className="ml-1 size-4" aria-hidden="true" />
              </Button>
              <Button
                render={<Link href="/company/opportunities/new" />}
                nativeButton={false}
                variant="outline"
                className="h-11 min-w-40 rounded-full border-navy/15 px-5 text-navy hover:bg-gray-light"
              >
                Build a challenge
              </Button>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.12} className="pb-10 sm:pb-14">
          <p className="text-center text-[11px] font-medium tracking-[0.08em] text-navy/68 uppercase">
            A fairer first step across every kind of work
          </p>
          <LogoLoop
            logos={roleCategories}
            speed={34}
            direction="left"
            logoHeight={18}
            gap={72}
            hoverSpeed={8}
            fadeOut
            fadeOutColor="#ffffff"
            scaleOnHover
            ariaLabel="Internship role categories"
            className="mt-5 py-1"
          />
        </Reveal>
      </div>
    </section>
  );
}

function RoleCategory({ icon: Icon, label }: { icon: typeof BarChart3; label: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap text-sm font-medium text-navy/68">
      <Icon className="size-4 text-teal-ink" strokeWidth={1.8} aria-hidden="true" />
      {label}
    </span>
  );
}

function CapabilityRail() {
  return (
    <section aria-labelledby="capabilities-heading" className="border-y border-navy/10 bg-white">
      <h2 id="capabilities-heading" className="sr-only">What internIn does</h2>
      <div className="mx-auto grid max-w-7xl divide-y divide-navy/10 px-5 sm:px-8 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-10">
        {capabilities.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-4 px-1 py-8 md:px-7 lg:px-9">
            <Icon className="mt-0.5 size-5 shrink-0 text-teal-ink" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-navy">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-navy/68">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EvidenceBand() {
  const facts = [
    ["1 human", "makes the hiring decision"],
    ["0 real", "company records exposed"],
    ["8 weeks", "in a generated program"],
    ["QAR 499", "only when you hire"],
  ];

  return (
    <section className="dot-field border-b border-navy/10 bg-gray-light/55">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
        <Reveal>
          <h2 className="mx-auto max-w-2xl text-center text-balance text-3xl font-semibold tracking-[-0.04em] text-navy sm:text-4xl">
            One continuous path from potential to verified experience.
          </h2>
        </Reveal>
        <dl className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-y-8 md:grid-cols-4">
          {facts.map(([value, label]) => (
            <div key={value} className="text-center md:border-l md:border-navy/10 md:first:border-l-0">
              <dt className="text-2xl font-semibold tracking-[-0.04em] text-navy sm:text-3xl">{value}</dt>
              <dd className="mx-auto mt-2 max-w-32 text-xs leading-5 text-navy/68">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function ProductStory() {
  return (
    <section id="product" className="bg-white">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32 lg:px-10 lg:py-36">
        <Reveal className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-medium tracking-[0.12em] text-teal-ink uppercase">The internIn system</p>
            <h2 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.05em] text-navy sm:text-5xl lg:text-6xl">
              Proof is the new first experience.
            </h2>
          </div>
          <Button
            render={<Link href="/company/opportunities/new" />}
            nativeButton={false}
            variant="outline"
            className="h-11 w-fit rounded-full border-navy/15 px-5 text-navy hover:bg-gray-light"
          >
            Try the company flow <ArrowRight className="ml-1 size-4" aria-hidden="true" />
          </Button>
        </Reveal>

        <div id="for-companies" className="mt-16 grid gap-10 border-t border-navy/10 pt-10 lg:grid-cols-[0.65fr_1.35fr] lg:gap-16 lg:pt-16">
          <Reveal>
            <p className="font-mono text-xs text-teal-ink">01 / BUILD</p>
            <h3 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-navy">From role to challenge in minutes.</h3>
            <p className="mt-5 max-w-md text-base leading-7 text-navy/68">
              A manager describes the work in plain language. internIn creates a realistic, editable assessment with synthetic assets and a clear rubric.
            </p>
            <ul className="mt-7 space-y-3 text-sm text-navy/68">
              {["AI proposes", "Company edits", "Human approves before publishing"].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <CircleCheck className="size-4 text-teal-ink" aria-hidden="true" /> {item}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.08}>
            <RoleChallengeDemo />
          </Reveal>
        </div>

        <div id="for-students" className="mt-24 grid gap-10 border-t border-navy/10 pt-10 lg:grid-cols-[1.25fr_0.75fr] lg:gap-16 lg:pt-16">
          <Reveal className="order-2 min-w-0 lg:order-1">
            <CandidateEvidenceTable />
          </Reveal>
          <Reveal className="order-1 lg:order-2" delay={0.08}>
            <p className="font-mono text-xs text-teal-ink">02 / REVIEW</p>
            <h3 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-navy">Evidence, not an AI hiring score.</h3>
            <p className="mt-5 max-w-md text-base leading-7 text-navy/68">
              Managers compare completed work, timing, insight, communication, and the original submission. The company always decides.
            </p>
            <div className="mt-8 border-l-2 border-teal pl-5">
              <p className="text-sm font-medium text-navy">No impressive CV required.</p>
              <p className="mt-1 text-sm leading-6 text-navy/68">Students earn consideration by showing what they can do.</p>
            </div>
          </Reveal>
        </div>

        <div className="mt-24 grid border-t border-navy/10 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal className="border-b border-navy/10 py-12 lg:border-r lg:border-b-0 lg:py-16 lg:pr-16">
            <SafeSimulationVisual />
            <div className="mt-9 max-w-lg">
              <p className="font-mono text-xs text-teal-ink">03 / PROTECT</p>
              <h3 className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-navy">Realistic work without real company data.</h3>
              <p className="mt-4 text-sm leading-6 text-navy/68">
                Synthetic datasets, fictional customers, and sanitized scenarios protect internal systems and prevent disguised free labor.
              </p>
            </div>
          </Reveal>

          <Reveal className="py-12 lg:py-16 lg:pl-16" delay={0.08}>
            <InternshipTimeline />
            <div className="mt-9 max-w-lg">
              <p className="font-mono text-xs text-teal-ink">04 / GROW</p>
              <h3 className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-navy">Hiring is only the beginning.</h3>
              <p className="mt-4 text-sm leading-6 text-navy/68">
                Turn the offer into an editable internship plan, track progress, collect feedback, and finish with supervisor-verified experience.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function CandidateEvidenceTable() {
  const candidates = [
    ["Ahmed", "5/6", "71m", "Insight", "Justification"],
    ["Sara", "6/6", "93m", "Presentation", "Time"],
    ["Noor", "5/6", "62m", "Speed", "Depth"],
  ];

  return (
    <div className="min-w-0 overflow-hidden border border-navy/12 bg-white">
      <div className="flex items-center justify-between border-b border-navy/10 px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-navy/68 uppercase">Candidate evidence</p>
          <p className="mt-1 text-sm font-medium text-navy">Data Analyst Intern</p>
        </div>
        <span className="rounded-full bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal-ink">3 compared</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[580px] border-collapse text-left text-sm">
          <caption className="sr-only">Candidate performance comparison for a Data Analyst internship</caption>
          <thead className="bg-gray-light/60 text-[11px] font-medium tracking-[0.08em] text-navy/68 uppercase">
            <tr>
              {['Candidate', 'Tasks', 'Time', 'Strength', 'Watch'].map((heading) => (
                <th key={heading} scope="col" className="px-5 py-3 font-medium">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/8 text-navy/68">
            {candidates.map((candidate, index) => (
              <tr key={candidate[0]} className={index === 1 ? "bg-teal/[0.035]" : undefined}>
                <th scope="row" className="px-5 py-4 font-semibold text-navy">{candidate[0]}</th>
                {candidate.slice(1).map((value) => <td key={value} className="px-5 py-4">{value}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-navy/10 px-5 py-4 text-xs text-navy/68">
        <span>Original work remains available</span>
        <span className="flex items-center gap-1.5 font-medium text-teal-ink">
          Human decision <UserRoundCheck className="size-4" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

function SafeSimulationVisual() {
  return (
    <div className="grid min-h-64 place-items-center border border-navy/10 bg-gray-light/35 p-6">
      <div className="grid w-full max-w-md grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="space-y-3">
          {[Database, LockKeyhole, BriefcaseBusiness].map((Icon, index) => (
            <div key={index} className="flex items-center gap-3 border border-navy/10 bg-white px-3 py-3 text-xs text-navy/68">
              <Icon className="size-4 text-navy/68" aria-hidden="true" />
              {index === 0 ? "Internal data" : index === 1 ? "Private systems" : "Real clients"}
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-2 text-teal-ink" aria-hidden="true">
          <span className="h-10 w-px bg-teal/25" />
          <ShieldCheck className="size-7" />
          <ArrowRight className="size-5" />
          <span className="h-10 w-px bg-teal/25" />
        </div>
        <div className="border border-teal/25 bg-white p-5">
          <FileSpreadsheet className="size-6 text-teal-ink" aria-hidden="true" />
          <p className="mt-4 text-sm font-semibold text-navy">Safe simulation</p>
          <p className="mt-2 text-xs leading-5 text-navy/68">Synthetic rows, fictional names, limited scope</p>
        </div>
      </div>
    </div>
  );
}

function InternshipTimeline() {
  return (
    <div className="min-h-64 border border-navy/10 bg-white p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-navy/68 uppercase">Internship program</p>
          <p className="mt-1 text-sm font-medium text-navy">Marketing Intern · 8 weeks</p>
        </div>
        <span className="text-xs font-medium text-teal-ink">On track</span>
      </div>
      <ol className="mt-10 grid grid-cols-4 gap-x-2 gap-y-7 sm:grid-cols-8">
        {weeks.map((week, index) => (
          <li key={week} className="relative text-center">
            <div className="relative mx-auto flex size-7 items-center justify-center rounded-full border border-teal/25 bg-white text-[10px] font-semibold text-teal-ink">
              {index < 3 ? <Check className="size-3.5" aria-label="Complete" /> : index + 1}
            </div>
            <p className="mt-3 text-[10px] leading-4 text-navy/68">{week}</p>
          </li>
        ))}
      </ol>
      <div className="mt-8 h-1.5 overflow-hidden rounded-full bg-gray-light" aria-label="Internship progress: 37 percent">
        <div className="h-full w-[37%] rounded-full bg-teal" />
      </div>
    </div>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="border-t border-navy/10 bg-gray-light/45">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28 lg:px-10">
        <Reveal>
          <div className="max-w-2xl">
            <p className="text-xs font-medium tracking-[0.12em] text-teal-ink uppercase">Simple pricing</p>
            <h2 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.05em] text-navy sm:text-5xl">
              Pay when proof becomes opportunity.
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-navy/68">AI is included. Students never pay to rank higher.</p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
            <article className="flex min-h-96 flex-col border border-navy/12 bg-white p-7 sm:p-9">
              <p className="text-sm font-semibold text-navy">Students</p>
              <p className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-navy">Free</p>
              <p className="mt-4 max-w-sm text-sm leading-6 text-navy/68">
                Your first opportunity should depend on your work, not your ability to pay.
              </p>
              <ul className="mt-8 space-y-4 text-sm text-navy/68">
                {["Explore relevant internships", "Complete realistic challenges", "Build verified experience"].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <Check className="size-4 text-teal-ink" aria-hidden="true" /> {item}
                  </li>
                ))}
              </ul>
              <Button
                render={<Link href="/signup?role=student" />}
                nativeButton={false}
                variant="outline"
                className="mt-auto h-11 w-full rounded-full border-navy/15 text-navy hover:bg-gray-light"
              >
                Create student profile
              </Button>
            </article>

            <article className="relative flex min-h-96 flex-col overflow-hidden border border-teal/35 bg-white p-7 sm:p-9">
              <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-teal" />
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-navy">Companies</p>
                  <p className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-navy">Free to start</p>
                </div>
                <span className="w-fit rounded-full bg-teal/10 px-3 py-1.5 text-xs font-semibold text-teal-ink">
                  Pay only on success
                </span>
              </div>
              <p className="mt-4 max-w-lg text-sm leading-6 text-navy/68">
                Create roles, generate safe challenges, and review candidate evidence before spending anything.
              </p>
              <ul className="mt-8 grid gap-4 text-sm text-navy/68 sm:grid-cols-2">
                {["AI challenge builder included", "Candidate evidence and comparison", "Human-controlled hiring", "No separate AI credits"].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <Check className="size-4 shrink-0 text-teal-ink" aria-hidden="true" /> {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-col gap-5 border-t border-navy/10 pt-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-medium tracking-[0.08em] text-navy/68 uppercase">When you hire an intern</p>
                  <p className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-teal-ink">QAR 499</p>
                  <p className="mt-1 text-xs text-navy/68">Includes internship management</p>
                </div>
                <Button
                  render={<Link href="/company/opportunities/new" />}
                  nativeButton={false}
                  className="h-11 rounded-full bg-teal-ink px-5 text-white hover:bg-[#0b625c]"
                >
                  Create an internship <ArrowRight className="ml-1 size-4" aria-hidden="true" />
                </Button>
              </div>
            </article>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="teal-dot-field overflow-hidden bg-teal text-white">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
        <Reveal className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-sm font-medium text-[#142438]">The first chance should start with proof.</p>
            <h2 className="mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.05em] sm:text-5xl lg:text-6xl">Give talent a way in.</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button render={<Link href="/signup?role=student" />} nativeButton={false} className="h-11 rounded-full bg-white px-5 text-navy hover:bg-white/90">
              Prove what you can do
            </Button>
            <Button render={<Link href="/company/opportunities/new" />} nativeButton={false} variant="outline" className="h-11 rounded-full border-navy/30 bg-transparent px-5 text-[#142438] hover:bg-white/20 hover:text-[#142438]">
              See what they can do
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
