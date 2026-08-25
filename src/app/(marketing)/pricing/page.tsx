import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const studentFeatures = [
  "Browse and apply to opportunities",
  "Complete AI-generated work challenges",
  "Build a verified experience record",
  "Always free — no pay-to-win",
];

const starterFeatures = [
  "Create unlimited internship listings",
  "AI Challenge Builder + AI edit-by-instruction",
  "Review candidate evidence",
  "QAR 499 only when you hire an intern",
  "Internship Program Builder included",
];

const proFeatures = [
  "Everything in Starter",
  "Unlimited active roles",
  "Candidate comparison & analytics",
  "Team members & company branding",
  "Custom challenge templates",
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight text-navy">
          Simple, honest pricing.
        </h1>
        <p className="mt-4 text-navy/70">
          You pay us only when we actually help you find an intern. No AI credits, no token
          pricing — just business value.
        </p>
      </div>

      <div className="mx-auto mt-16 grid max-w-5xl gap-6 lg:grid-cols-3">
        <PlanCard title="Students" price="Free" subtitle="Always" features={studentFeatures} />
        <PlanCard
          title="Company Starter"
          price="Free to start"
          subtitle="QAR 499 per successful intern"
          features={starterFeatures}
          highlighted
        />
        <PlanCard
          title="Company Pro"
          price="QAR 499–999"
          subtitle="per month"
          features={proFeatures}
        />
      </div>

      <p className="mx-auto mt-16 max-w-lg text-center text-sm text-navy/50">
        Enterprise (SSO, API, audit logs) and University plans are available on request.
      </p>
    </div>
  );
}

function PlanCard({
  title,
  price,
  subtitle,
  features,
  highlighted,
}: {
  title: string;
  price: string;
  subtitle: string;
  features: string[];
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-7 ${
        highlighted ? "border-teal/30 bg-white ring-1 ring-teal/10" : "border-gray-cool/60 bg-white"
      }`}
    >
      <p className="text-sm font-semibold text-navy">{title}</p>
      <p className="mt-2 text-2xl font-bold text-navy">{price}</p>
      <p className="text-xs text-navy/50">{subtitle}</p>
      <ul className="mt-6 space-y-2.5 text-sm text-navy/70">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-teal" /> {f}
          </li>
        ))}
      </ul>
      <Button
        render={<Link href="/company/opportunities/new" />} nativeButton={false}
        className={`mt-7 w-full ${highlighted ? "bg-teal text-white hover:bg-teal/90" : ""}`}
        variant={highlighted ? "default" : "outline"}
      >
        Get started
      </Button>
    </div>
  );
}
