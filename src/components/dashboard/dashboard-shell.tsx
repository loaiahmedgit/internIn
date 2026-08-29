"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/ui/wordmark";
import { AccountMenu } from "@/components/dashboard/account-menu";
import {
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Home,
  Compass,
  ClipboardList,
  Zap,
  Building2,
  User,
  BadgeCheck,
  Briefcase,
  PlusCircle,
  Users,
  GraduationCap,
  BarChart3,
  Plug,
} from "lucide-react";
import type { NavItem, IconName } from "@/lib/dashboard-nav";

const STORAGE_KEY = "internin-sidebar-collapsed";

// Resolved here, not in the shared data — the icon components themselves
// can't cross the Server -> Client prop boundary (NavItem carries only a
// string name for exactly that reason).
const ICON_MAP: Record<IconName, typeof ClipboardList> = {
  home: Home,
  compass: Compass,
  "clipboard-list": ClipboardList,
  zap: Zap,
  building: Building2,
  user: User,
  "badge-check": BadgeCheck,
  briefcase: Briefcase,
  "plus-circle": PlusCircle,
  users: Users,
  "graduation-cap": GraduationCap,
  "bar-chart-3": BarChart3,
  plug: Plug,
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = ICON_MAP[item.icon];
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 ${
        active ? "bg-teal/8 text-teal-ink" : "text-navy/60 hover:bg-gray-light hover:text-navy"
      }`}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-navy px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 z-50"
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}

export function DashboardShell({
  children,
  navItems,
  eyebrow,
  displayName,
  accountSubLabel = "Account",
  personName,
  personEmail,
  accountMenuLinks,
}: {
  children: React.ReactNode;
  navItems: NavItem[];
  eyebrow: string;
  displayName: string;
  /** Sub-label under the sidebar footer name, e.g. "Company account". */
  accountSubLabel?: string;
  /** Signed-in person's identity — distinct from the company/workspace name in the sidebar footer. */
  personName?: string;
  personEmail?: string;
  /** Real account/workspace pages for the sidebar account dropdown. Omit rather than link to a page that doesn't exist. */
  accountMenuLinks?: { href: string; label: string; icon: "user" | "settings" }[];
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      // Reading localStorage can only happen after hydration (SSR has no
      // access to it) — that's a genuine one-time read of an external
      // system, not the "derived state" pattern the lint rule targets.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
    } catch {
      // localStorage unavailable (private mode etc.) — default to expanded.
    }
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    closeButtonRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  function closeMobileMenu() {
    setMobileOpen(false);
    menuButtonRef.current?.focus();
  }

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore — preference just won't persist this session
      }
      return next;
    });
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden sm:flex-row">
      {/* Desktop sidebar — fixed to the viewport height, never scrolls with content */}
      <aside
        className={`hidden h-full shrink-0 flex-col border-r border-navy/10 transition-[width] duration-200 sm:flex ${
          collapsed ? "w-[72px]" : "w-[248px]"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-5">
          {collapsed ? (
            <Link href="/" aria-label="internIn home" className="flex size-8 items-center justify-center rounded-lg hover:bg-gray-light">
              <span className="size-2.5 rounded-full bg-teal" aria-hidden="true" />
            </Link>
          ) : (
            <Link href="/" className="min-w-0">
              <Wordmark size="sm" />
            </Link>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-navy/40 transition-colors hover:bg-gray-light hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
          >
            {collapsed ? <PanelLeftOpen className="size-4" aria-hidden="true" /> : <PanelLeftClose className="size-4" aria-hidden="true" />}
          </button>
        </div>

        {!collapsed && (
          <p className="px-7 text-[11px] font-medium uppercase tracking-[0.1em] text-navy/40">{eyebrow}</p>
        )}

        <nav className="mt-2 flex flex-col gap-0.5 px-3">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} collapsed={collapsed} />
          ))}
        </nav>

        <div className="mt-auto border-t border-navy/10 px-4 py-4">
          {collapsed ? (
            <div className="flex justify-center">
              <div
                className="flex size-8 items-center justify-center rounded-full bg-teal/10 text-xs font-semibold text-teal-ink"
                role="img"
                aria-label={personName ?? displayName}
                title={personName ?? displayName}
              >
                {(personName ?? displayName).charAt(0).toUpperCase() || "?"}
              </div>
            </div>
          ) : (
            <AccountMenu
              label={personName ?? displayName}
              subLabel={personName ? displayName : accountSubLabel}
              email={personName ? personEmail : undefined}
              workspaceLabel={personName ? `${displayName} · ${accountSubLabel}` : undefined}
              menuLinks={accountMenuLinks}
              variant="sidebar"
            />
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-navy/10 px-5 py-3 sm:hidden">
        <Link href="/">
          <Wordmark size="sm" />
        </Link>
        <button
          type="button"
          ref={menuButtonRef}
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="flex size-9 items-center justify-center rounded-md text-navy transition-colors hover:bg-gray-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </div>

      {/* Mobile drawer — a real overlay, not the fixed desktop rail squeezed down */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close navigation" onClick={closeMobileMenu} className="absolute inset-0 bg-navy/30" />
          <div className="absolute inset-y-0 left-0 flex w-[260px] flex-col bg-white shadow-[0_0_40px_rgba(33,50,72,0.15)]">
            <div className="flex items-center justify-between px-4 py-5">
              <Link href="/" onClick={closeMobileMenu}>
                <Wordmark size="sm" />
              </Link>
              <button
                type="button"
                ref={closeButtonRef}
                onClick={closeMobileMenu}
                aria-label="Close navigation"
                className="flex size-8 items-center justify-center rounded-md text-navy/60 hover:bg-gray-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <p className="px-7 text-[11px] font-medium uppercase tracking-[0.1em] text-navy/40">{eyebrow}</p>
            <nav className="mt-2 flex flex-col gap-0.5 px-3">
              {navItems.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} collapsed={false} onNavigate={closeMobileMenu} />
              ))}
            </nav>
            <div className="mt-auto border-t border-navy/10 px-4 py-4">
              <AccountMenu
                label={personName ?? displayName}
                email={personName ? personEmail : undefined}
                subLabel={personName ? `${displayName} · ${accountSubLabel}` : accountSubLabel}
                variant="sidebar"
              />
            </div>
          </div>
        </div>
      )}

      {/* The only scroll container in the authenticated shell */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
