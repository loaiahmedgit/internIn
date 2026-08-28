import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { COMPANY_NAV_ITEMS } from "@/lib/dashboard-nav";

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  let companyName = "";
  if (user) {
    const db = getDb();
    const [membership] = await db
      .select({ name: schema.companies.name })
      .from(schema.companyMembers)
      .innerJoin(schema.companies, eq(schema.companyMembers.companyId, schema.companies.id))
      .where(eq(schema.companyMembers.userId, user.id))
      .limit(1);
    companyName = membership?.name ?? "";
  }

  return (
    <DashboardShell
      eyebrow="Company workspace"
      displayName={companyName || user?.fullName || ""}
      accountSubLabel="Company account"
      personName={user?.fullName}
      personEmail={user?.email}
      showTopBar
      navItems={COMPANY_NAV_ITEMS}
    >
      {children}
    </DashboardShell>
  );
}
