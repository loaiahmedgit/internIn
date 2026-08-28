"use client";

import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * No unread dot or count — there's no notifications table/event feed backing
 * this yet, so it never claims there's something new. Real UI affordance
 * for where notifications will live, not a fabricated activity indicator.
 */
export function NotificationBell() {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Notifications"
        className="flex size-8 items-center justify-center rounded-full text-navy/50 transition-colors hover:bg-gray-light hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
      >
        <Bell className="size-[18px]" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="text-sm font-medium text-navy">Notifications</p>
        <p className="text-sm text-navy/50">No new notifications.</p>
      </PopoverContent>
    </Popover>
  );
}
