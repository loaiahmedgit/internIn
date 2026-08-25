import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/(auth)/actions";
import { Sparkles } from "lucide-react";

export default async function CompanyDashboardPage() {
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

  const opportunities = await db
    .select()
    .from(schema.opportunities)
    .where(eq(schema.opportunities.companyId, membership.company.id));

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">
            {membership.company.name}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-navy">Internships</h1>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="ghost" className="text-navy/60">
            Sign out
          </Button>
        </form>
      </div>

      {opportunities.length === 0 ? (
        <div className="mt-16 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-teal/10">
            <Sparkles className="size-6 text-teal" />
          </div>
          <h2 className="mt-6 text-lg font-semibold text-navy">No internships yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-navy/60">
            Describe the role to internIn&apos;s AI and get a structured listing plus a realistic work
            challenge in minutes.
          </p>
          <Button
            render={<Link href="/company/opportunities/new" />}
            nativeButton={false}
            size="lg"
            className="mt-8 bg-teal text-white hover:bg-teal/90"
          >
            <Sparkles className="mr-1.5 size-4" /> Create Internship
          </Button>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {opportunities.map((o) => (
            <Link
              key={o.id}
              href={`/company/opportunities/${o.id}`}
              className="block rounded-lg border border-gray-cool/60 bg-white p-4 transition-colors hover:border-teal/40"
            >
              <p className="font-medium text-navy">{o.role}</p>
              <p className="text-sm text-navy/50">
                {o.duration} · {o.hoursPerWeek}h/week · {o.location}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
