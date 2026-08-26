import { getCurrentUser } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { STUDENT_NAV_ITEMS } from "@/lib/dashboard-nav";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <DashboardShell eyebrow="Student" displayName={user?.fullName ?? ""} navItems={STUDENT_NAV_ITEMS}>
      {children}
    </DashboardShell>
  );
}
