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
  | "settings"
  | "sparkles";

export type NavItem = { href: string; label: string; icon: IconName };

// Discovery/career nav — deliberately 4 items (For You / Explore /
// Applications / Profile), not the old 7-item scheme. Challenges fold into
// the application flow, Internships becomes a separate post-hire workspace
// (reached from For You / Applications once an offer is accepted, not a
// permanent nav item here), and Verified Experience becomes a Profile
// section — see the product-phase audit for the full reasoning.
export const STUDENT_NAV_ITEMS: NavItem[] = [
  { href: "/student/dashboard", label: "For You", icon: "sparkles" },
  { href: "/student/opportunities", label: "Explore", icon: "compass" },
  { href: "/student/applications", label: "Applications", icon: "clipboard-list" },
  { href: "/student/profile", label: "Profile", icon: "user" },
];

export const COMPANY_NAV_ITEMS: NavItem[] = [
  { href: "/company/dashboard", label: "Home", icon: "home" },
  { href: "/company/internships", label: "Internships", icon: "briefcase" },
  { href: "/company/candidates", label: "Candidates", icon: "users" },
  { href: "/company/analytics", label: "Analytics", icon: "bar-chart-3" },
  { href: "/company/assistant", label: "Ask internIn", icon: "sparkles" },
  { href: "/company/integrations", label: "Integrations", icon: "plug" },
  { href: "/company/settings", label: "Settings", icon: "settings" },
];
