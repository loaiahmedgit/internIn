"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/ui/wordmark";
import { signOut } from "@/app/(auth)/actions";

type NavItem = { href: string; label: string };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
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

  return (
    <div className="flex min-h-full flex-col sm:flex-row">
      <aside className="hidden w-[248px] shrink-0 border-r border-navy/10 sm:flex sm:flex-col sm:px-5 sm:py-6">
        <Link href="/" className="px-1">
          <Wordmark size="sm" />
        </Link>
        <p className="mt-7 px-1 text-[11px] font-medium uppercase tracking-[0.1em] text-navy/40">{eyebrow}</p>
        <nav className="mt-2 flex flex-col gap-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(pathname, item.href)
                  ? "bg-teal/8 text-teal-ink"
                  : "text-navy/60 hover:bg-gray-light hover:text-navy"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto pt-6">
          <p className="truncate px-1 text-sm font-medium text-navy">{displayName}</p>
          <form action={signOut}>
            <button type="submit" className="mt-1 px-1 text-xs text-navy/40 transition-colors hover:text-navy/70">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex flex-col border-b border-navy/10 sm:hidden">
        <div className="flex items-center justify-between px-5 py-3">
          <Link href="/">
            <Wordmark size="sm" />
          </Link>
          <form action={signOut}>
            <button type="submit" className="text-xs text-navy/40">
              Sign out
            </button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-5 pb-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                isActive(pathname, item.href) ? "bg-teal/8 text-teal-ink" : "text-navy/60"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
