import { ClipboardList, User, BadgeCheck, Briefcase, PlusCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const STUDENT_NAV_ITEMS: NavItem[] = [
  { href: "/student/dashboard", label: "Applications", icon: ClipboardList },
  { href: "/student/profile", label: "Profile", icon: User },
  { href: "/student/experience", label: "Verified Experience", icon: BadgeCheck },
];

export const COMPANY_NAV_ITEMS: NavItem[] = [
  { href: "/company/dashboard", label: "Internships", icon: Briefcase },
  { href: "/company/opportunities/new", label: "Create internship", icon: PlusCircle },
];
