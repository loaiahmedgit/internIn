// Icon *names*, not component references — this data crosses from Server
// Components (the layouts) into DashboardShell ("use client"), and React
// Server Components cannot serialize function/component references across
// that boundary. The actual lucide-react components are only resolved
// inside dashboard-shell.tsx, which is already a client module.
export type IconName =
  | "home"
  | "compass"
  | "clipboard-list"
  | "zap"
  | "building"
  | "user"
  | "badge-check"
  | "briefcase"
  | "plus-circle"
  | "users"
  | "graduation-cap"
  | "bar-chart-3"
  | "plug"
  | "settings";

export type NavItem = { href: string; label: string; icon: IconName };

export const STUDENT_NAV_ITEMS: NavItem[] = [
  { href: "/student/dashboard", label: "Home", icon: "home" },
  { href: "/student/opportunities", label: "Opportunities", icon: "compass" },
  { href: "/student/applications", label: "Applications", icon: "clipboard-list" },
  { href: "/student/challenges", label: "Challenges", icon: "zap" },
  { href: "/student/internships", label: "Internships", icon: "building" },
  { href: "/student/experience", label: "Verified Experience", icon: "badge-check" },
  { href: "/student/profile", label: "Profile", icon: "user" },
];

export const COMPANY_NAV_ITEMS: NavItem[] = [
  { href: "/company/dashboard", label: "Home", icon: "home" },
  { href: "/company/internships", label: "Internships", icon: "briefcase" },
  { href: "/company/candidates", label: "Candidates", icon: "users" },
  { href: "/company/analytics", label: "Analytics", icon: "bar-chart-3" },
  { href: "/company/integrations", label: "Integrations", icon: "plug" },
  { href: "/company/settings", label: "Settings", icon: "settings" },
];
