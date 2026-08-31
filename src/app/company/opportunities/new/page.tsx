import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { CreateInternshipForm } from "@/components/opportunities/create-internship-form";

export default async function NewOpportunityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const db = getDb();
  const [membership] = await db
    .select()
    .from(schema.companyMembers)
    .where(eq(schema.companyMembers.userId, user.id))
    .limit(1);

  if (!membership) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-navy/60">
        This account isn&apos;t linked to a company yet.
      </div>
    );
  }

  return <CreateInternshipForm />;
}
