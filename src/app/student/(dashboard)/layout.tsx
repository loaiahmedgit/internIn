import { getCurrentUser } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <DashboardShell
      eyebrow="Student"
      displayName={user?.fullName ?? ""}
      navItems={[
        { href: "/student/dashboard", label: "Applications" },
        { href: "/student/profile", label: "Profile" },
        { href: "/student/experience", label: "Verified Experience" },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
