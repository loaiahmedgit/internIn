import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { ApplyButton } from "@/components/opportunities/apply-button";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { STUDENT_NAV_ITEMS } from "@/lib/dashboard-nav";

export const dynamic = "force-dynamic";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();

  const [opportunity] = await db
    .select({
      id: schema.opportunities.id,
      role: schema.opportunities.role,
      description: schema.opportunities.description,
      duration: schema.opportunities.duration,
      hoursPerWeek: schema.opportunities.hoursPerWeek,
      location: schema.opportunities.location,
      skills: schema.opportunities.skills,
      status: schema.opportunities.status,
      companyName: schema.companies.name,
    })
    .from(schema.opportunities)
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(eq(schema.opportunities.id, id))
    .limit(1);

  if (!opportunity || opportunity.status !== "published") notFound();

  const content = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">{opportunity.companyName}</p>
      <h1 className="mt-2 text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">{opportunity.role}</h1>
      <p className="mt-2 text-sm text-navy/68">
        {opportunity.duration} · {opportunity.hoursPerWeek}h/week · {opportunity.location}
      </p>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {opportunity.skills.map((s) => (
          <span key={s} className="rounded-full bg-gray-light px-2.5 py-1 text-xs text-navy/68">
            {s}
          </span>
        ))}
      </div>

      <p className="mt-8 whitespace-pre-wrap text-navy/80">{opportunity.description}</p>

      <div className="mt-10">
        <ApplyButton opportunityId={opportunity.id} />
      </div>
    </>
  );

  const currentUser = await getCurrentUser();

  if (currentUser?.role === "student") {
    return (
      <DashboardShell eyebrow="Student" displayName={currentUser.fullName} navItems={STUDENT_NAV_ITEMS}>
        <div className="max-w-3xl px-6 py-10 sm:px-10 sm:py-14 lg:px-14">{content}</div>
      </DashboardShell>
    );
  }

  const dashboardHref = currentUser ? (currentUser.role === "company" ? "/company/dashboard" : "/student/dashboard") : null;

  return (
    <div className="flex min-h-full flex-col">
      <Navbar dashboardHref={dashboardHref} />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8">{content}</div>
      </main>
      <Footer />
    </div>
  );
}
