"use client";

import { ChevronDown, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/(auth)/actions";

/**
 * One dropdown, two visual shells: the sidebar footer row (full label +
 * sub-label + chevron) and the compact top-bar avatar (initials only). Both
 * only ever offer Sign out — there's no company-settings or profile page to
 * link to yet, so the menu doesn't pretend one exists.
 */
export function AccountMenu({
  label,
  subLabel,
  variant,
}: {
  label: string;
  subLabel: string;
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
      <DropdownMenuContent align={variant === "sidebar" ? "start" : "end"} className="w-48">
        <div className="px-1.5 py-1">
          <p className="truncate text-sm font-medium text-navy">{label}</p>
          <p className="truncate text-xs text-navy/45">{subLabel}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="text-navy/70">
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
