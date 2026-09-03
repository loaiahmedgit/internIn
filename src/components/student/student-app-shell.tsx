"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Briefcase, ClipboardList, Compass, Home, User } from "lucide-react";
import { AccountMenu } from "@/components/dashboard/account-menu";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { Wordmark } from "@/components/ui/wordmark";
import { STUDENT_NAV_ITEMS, type IconName, type NavItem } from "@/lib/dashboard-nav";

const STUDENT_ICON_MAP: Partial<Record<IconName, typeof Compass>> = {
  home: Home,
  compass: Compass,
  "clipboard-list": ClipboardList,
  user: User,
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function DesktopNavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-[4.5rem] items-center px-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 focus-visible:ring-offset-4 ${
        active ? "text-teal-ink" : "text-navy/58 hover:text-navy"
      }`}
    >
      {item.label}
      {active ? <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-teal" aria-hidden="true" /> : null}
    </Link>
  );
}

function MobileNavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = STUDENT_ICON_MAP[item.icon] ?? Compass;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 ${
        active ? "text-teal-ink" : "text-navy/48 hover:text-navy"
      }`}
    >
      <Icon className="size-[18px]" aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}

/**
 * Consumer-facing student shell. It deliberately does not share the
 * company DashboardShell: discovery and applications use top-level app
 * navigation on desktop and compact bottom navigation on mobile.
 */
export function StudentAppShell({
  children,
  displayName,
  activeInternship,
}: {
  children: React.ReactNode;
  displayName: string;
  /** Accepted internship's role — only enough to label the persistent entry
   * point below. Null/undefined when the student has none; full program
   * detail lives in the separate Internship Workspace, not here. */
  activeInternship?: { role: string } | null;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-[#f8fafb] text-navy">
      <a
        href="#student-main"
        className="fixed top-2 left-2 z-50 -translate-y-16 rounded-lg bg-navy px-3 py-2 text-sm font-medium text-white transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-20 border-b border-navy/8 bg-white/95 backdrop-blur-md">
        <div className="mx-auto grid h-14 max-w-[1440px] grid-cols-[1fr_auto] items-center px-4 sm:px-6 md:h-[4.5rem] md:grid-cols-[1fr_auto_1fr] lg:px-8">
          <Link
            href="/student/dashboard"
            aria-label="internIn student home"
            className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
          >
            <Wordmark size="sm" className="h-7 md:h-8" />
          </Link>

          <nav aria-label="Student app" className="hidden h-full items-center gap-9 md:flex">
            {STUDENT_NAV_ITEMS.map((item) => (
              <DesktopNavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 md:justify-self-end">
            {activeInternship && (
              <Link
                href="/student/internships"
                className="hidden items-center gap-1.5 rounded-full border border-teal/20 bg-teal/6 px-3 py-1.5 text-xs font-medium text-teal-ink transition-colors hover:bg-teal/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 sm:flex"
              >
                <Briefcase className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="max-w-[9rem] truncate">{activeInternship.role}</span>
                <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
              </Link>
            )}
            <NotificationBell />
            <AccountMenu label={displayName} subLabel="Student account" variant="topbar" />
          </div>
        </div>
      </header>

      <main id="student-main" className="pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>

      <nav
        aria-label="Student app"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-navy/10 bg-white/96 px-2 pt-1.5 backdrop-blur-md [padding-bottom:calc(0.5rem+env(safe-area-inset-bottom))] md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
          {STUDENT_NAV_ITEMS.map((item) => (
            <MobileNavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </div>
      </nav>
    </div>
  );
}
