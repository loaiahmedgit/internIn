import { getCurrentUser, getCurrentCompanyMembership } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { COMPANY_NAV_ITEMS } from "@/lib/dashboard-nav";
import Link from "next/link";
import { hasPermission } from "@/lib/company/permissions";

export default async function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // getCurrentUser() and getCurrentCompanyMembership() are both React
  // cache()-memoized per request: every page.tsx under this layout calls
  // requireCurrentCompanyMember() too, and now reuses this exact lookup
  // instead of running a second company_members query on every navigation.
  const user = await getCurrentUser();
  const membership = await getCurrentCompanyMembership();

  let companyName = "";
  let allowed = false;
  let navItems = COMPANY_NAV_ITEMS;
  if (membership.ok) {
    // Layouts persist across client navigation. Feature authorization belongs
    // in each page's data loader/action, not a cached pathname decision here.
    companyName = membership.companyName;
    allowed = true;
    if (!hasPermission(membership.membership, "hiring_reviewer"))
      navItems = COMPANY_NAV_ITEMS.filter((n) =>
        ["Settings", "Integrations"].includes(n.label),
      );
  }

  return (
    <DashboardShell
      eyebrow="Hiring workspace"
      displayName={companyName || user?.fullName || ""}
      accountSubLabel="Hiring workspace"
      personName={user?.fullName}
      personEmail={user?.email}
      accountMenuLinks={[
        { href: "/company/profile", label: "Profile", icon: "user" },
        { href: "/company/settings", label: "Settings", icon: "settings" },
      ]}
      navItems={navItems}
    >
      {allowed ? (
        children
      ) : (
        <div className="p-10">
          <h1 className="text-xl font-semibold text-navy">
            Workspace access required
          </h1>
          <p className="mt-3 text-sm text-navy/65">
            Ask a workspace administrator to grant the permissions for this
            area.
          </p>
          <Link
            className="mt-4 inline-block text-sm text-teal-ink underline"
            href="/company/settings"
          >
            Settings
          </Link>
        </div>
      )}
    </DashboardShell>
  );
}
