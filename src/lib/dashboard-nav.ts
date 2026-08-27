// Icon *names*, not component references — this data crosses from Server
// Components (the layouts) into DashboardShell ("use client"), and React
// Server Components cannot serialize function/component references across
// that boundary. The actual lucide-react components are only resolved
// inside dashboard-shell.tsx, which is already a client module.
export type IconName = "clipboard-list" | "user" | "badge-check" | "briefcase" | "plus-circle";

export type NavItem = { href: string; label: string; icon: IconName };

export const STUDENT_NAV_ITEMS: NavItem[] = [
  { href: "/student/dashboard", label: "Applications", icon: "clipboard-list" },
  { href: "/student/profile", label: "Profile", icon: "user" },
  { href: "/student/experience", label: "Verified Experience", icon: "badge-check" },
];

export const COMPANY_NAV_ITEMS: NavItem[] = [
  { href: "/company/dashboard", label: "Internships", icon: "briefcase" },
  { href: "/company/opportunities/new", label: "Create internship", icon: "plus-circle" },
];
