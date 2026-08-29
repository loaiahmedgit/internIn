"use client";

import { ChevronDown, LogOut, User, Settings } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/(auth)/actions";

const LINK_ICON = { user: User, settings: Settings } as const;

/**
 * One dropdown, two visual shells: the sidebar footer row (compact — name +
 * one context line) and the compact top-bar avatar (initials only). The
 * dropdown popup carries the fuller identity (name, email, workspace) plus
 * whatever real account links the caller passes — Student/topbar callers
 * pass none of the optional fields and get the original plain "Sign out
 * only" menu, unchanged.
 */
export function AccountMenu({
  label,
  subLabel,
  email,
  workspaceLabel,
  menuLinks,
  variant,
}: {
  /** Name shown everywhere — trigger line 1 and dropdown-header line 1. */
  label: string;
  /** Trigger line 2. Also the dropdown-header line 2 when `email` isn't given. */
  subLabel: string;
  /** Dropdown-header line 2, when the trigger's `subLabel` is a person's email but the trigger itself should stay short. */
  email?: string;
  /** Dropdown-header line 3, e.g. "Skyline Logistics · Company workspace". Only rendered alongside `email`. */
  workspaceLabel?: string;
  /** Real account/workspace pages to link to, shown above the final Sign out separator. Omit rather than link to a page that doesn't exist. */
  menuLinks?: { href: string; label: string; icon: keyof typeof LINK_ICON }[];
  variant: "sidebar" | "topbar";
}) {
  const initial = label.charAt(0).toUpperCase() || "?";

  return (
    <DropdownMenu>
      {variant === "sidebar" ? (
        <DropdownMenuTrigger
          className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left transition-colors hover:bg-gray-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
          aria-label={`${label} account menu`}
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal/10 text-xs font-semibold text-teal-ink"
            aria-hidden="true"
          >
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-navy">{label}</span>
            <span className="block truncate text-xs text-navy/45">{subLabel}</span>
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-navy/40" aria-hidden="true" />
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger
          className="flex items-center gap-1 rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
          aria-label={`${label} account menu`}
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal/10 text-xs font-semibold text-teal-ink"
            aria-hidden="true"
          >
            {initial}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-navy/40" aria-hidden="true" />
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align={variant === "sidebar" ? "start" : "end"} className="w-56">
        <div className="px-1.5 py-1">
          <p className="truncate text-sm font-medium text-navy">{label}</p>
          <p className="truncate text-xs text-navy/45">{email ?? subLabel}</p>
          {email && workspaceLabel && <p className="truncate text-xs text-navy/45">{workspaceLabel}</p>}
        </div>
        {menuLinks && menuLinks.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {menuLinks.map((link) => {
              const Icon = LINK_ICON[link.icon];
              return (
                <DropdownMenuItem key={link.href} render={<Link href={link.href} />}>
                  <Icon className="size-4" aria-hidden="true" />
                  {link.label}
                </DropdownMenuItem>
              );
            })}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="text-navy/70">
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
