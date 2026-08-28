import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { getCompanyHomeData } from "@/lib/company/home-data";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

export default async function CompanyAnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const db = getDb();
  const [membership] = await db
    .select({ company: schema.companies })
    .from(schema.companyMembers)
    .innerJoin(schema.companies, eq(schema.companyMembers.companyId, schema.companies.id))
    .where(eq(schema.companyMembers.userId, user.id))
    .limit(1);

  if (!membership) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-navy/60">
        This account isn&apos;t linked to a company yet.
      </div>
    );
  }

  const data = await getCompanyHomeData(membership.company.id);
  const steps: { label: string; value: number }[] = [
    { label: "Applied", value: data.funnel.applied },
    { label: "Challenge submitted", value: data.funnel.submitted },
    { label: "Shortlisted", value: data.funnel.shortlisted },
    { label: "Invited", value: data.funnel.invited },
    { label: "Accepted", value: data.funnel.accepted },
  ];
  const maxValue = Math.max(1, ...steps.map((s) => s.value));

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-teal-ink">Analytics</p>
      <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">Analytics</h1>
      <p className="mt-2 max-w-2xl text-sm text-navy/60">
        A first look at how candidates move through your internships.
      </p>

      <Card className="mt-8 rounded-xl border border-navy/10 shadow-none ring-0">
        <CardContent className="px-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy/50">Hiring funnel</h2>
          <div className="mt-5 space-y-3">
            {steps.map((step) => (
              <div key={step.label} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm text-navy/70">{step.label}</span>
                <div className="h-2 min-w-0 flex-1 rounded-full bg-navy/8">
                  <div
                    className="h-full rounded-full bg-teal"
                    style={{ width: `${(step.value / maxValue) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-sm font-semibold text-navy">{step.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6 rounded-xl border border-navy/10 shadow-none ring-0">
        <CardContent className="px-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy/50">Internship program health</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="Active interns" value={data.activeInterns} />
            <Stat label="Needing attention" value={data.internsNeedingAttention} />
            <Stat label="Open internships" value={data.openInternships} />
          </div>
        </CardContent>
      </Card>

      <p className="mt-6 flex items-center gap-1.5 text-sm text-navy/50">
        More detailed breakdowns are on the way <ArrowRight className="size-3.5" aria-hidden="true" />
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-semibold tracking-[-0.02em] text-navy">{value}</p>
      <p className="text-xs text-navy/50">{label}</p>
    </div>
  );
}
