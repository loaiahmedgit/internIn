import Link from "next/link";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const db = getDb();
  const opportunities = await db
    .select({
      id: schema.opportunities.id,
      role: schema.opportunities.role,
      duration: schema.opportunities.duration,
      hoursPerWeek: schema.opportunities.hoursPerWeek,
      location: schema.opportunities.location,
      skills: schema.opportunities.skills,
      companyName: schema.companies.name,
    })
    .from(schema.opportunities)
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(eq(schema.opportunities.status, "published"));

  return (
    <div className="mx-auto max-w-5xl px-5 py-20 sm:px-8">
      <p className="text-xs font-medium tracking-[0.12em] text-teal-ink uppercase">Opportunities</p>
      <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">
        Prove what you can do.
      </h1>

      {opportunities.length === 0 ? (
        <p className="mt-12 text-navy/68">
          No published opportunities yet. Companies are still building challenges — check back soon.
        </p>
      ) : (
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {opportunities.map((o) => (
            <Link
              key={o.id}
              href={`/opportunities/${o.id}`}
              className="block border border-navy/12 bg-white p-6 transition-colors hover:border-teal/40"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">{o.companyName}</p>
              <p className="mt-1.5 text-lg font-semibold text-navy">{o.role}</p>
              <p className="mt-2 text-sm text-navy/68">
                {o.duration} · {o.hoursPerWeek}h/week · {o.location}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {o.skills.slice(0, 4).map((s) => (
                  <span key={s} className="rounded-full bg-gray-light px-2.5 py-1 text-xs text-navy/68">
                    {s}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
