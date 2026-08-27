"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/ui/wordmark";
import { signOut } from "@/app/(auth)/actions";
import { Menu, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { NavItem } from "@/lib/dashboard-nav";

const STORAGE_KEY = "internin-sidebar-collapsed";

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
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 ${
        active ? "bg-teal/8 text-teal-ink" : "text-navy/60 hover:bg-gray-light hover:text-navy"
      }`}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && (
        <span
          role="tooltip"
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
}: {
  children: React.ReactNode;
  navItems: NavItem[];
  eyebrow: string;
  displayName: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
    } catch {
      // localStorage unavailable (private mode etc.) — default to expanded.
    }
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

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
            <div className="flex justify-center" title={displayName}>
              <div className="flex size-8 items-center justify-center rounded-full bg-teal/10 text-xs font-semibold text-teal-ink">
                {displayName.charAt(0).toUpperCase() || "?"}
              </div>
            </div>
          ) : (
            <>
              <p className="truncate px-1 text-sm font-medium text-navy">{displayName}</p>
              <form action={signOut}>
                <button type="submit" className="mt-1 px-1 text-xs text-navy/40 transition-colors hover:text-navy/70">
                  Sign out
                </button>
              </form>
            </>
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
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="flex size-9 items-center justify-center rounded-md text-navy transition-colors hover:bg-gray-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </div>

      {/* Mobile drawer — a real overlay, not the fixed desktop rail squeezed down */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-navy/30"
          />
          <div className="absolute inset-y-0 left-0 flex w-[260px] flex-col bg-white shadow-[0_0_40px_rgba(33,50,72,0.15)]">
            <div className="flex items-center justify-between px-4 py-5">
              <Link href="/" onClick={() => setMobileOpen(false)}>
                <Wordmark size="sm" />
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="flex size-8 items-center justify-center rounded-md text-navy/60 hover:bg-gray-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <p className="px-7 text-[11px] font-medium uppercase tracking-[0.1em] text-navy/40">{eyebrow}</p>
            <nav className="mt-2 flex flex-col gap-0.5 px-3">
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                  collapsed={false}
                  onNavigate={() => setMobileOpen(false)}
                />
              ))}
            </nav>
            <div className="mt-auto border-t border-navy/10 px-4 py-4">
              <p className="truncate px-1 text-sm font-medium text-navy">{displayName}</p>
              <form action={signOut}>
                <button type="submit" className="mt-1 px-1 text-xs text-navy/40 hover:text-navy/70">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* The only scroll container in the authenticated shell */}
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
