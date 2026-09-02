"use client";

import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";

/**
 * The shadcn date-picker pattern (Popover + Calendar), used for both
 * application deadline and start date — replaces the native browser
 * `<input type="date">` with something that looks and behaves consistently
 * across browsers, shows a friendly "Sep 16, 2026" label, and can disable
 * invalid dates directly instead of only rejecting them after the fact.
 */
export function DatePickerField({
  value,
  onChange,
  minDate,
  placeholder = "Pick a date",
  ariaLabel = "Choose date",
}: {
  value: Date | null;
  onChange: (date: Date | null) => void;
  /** Dates before this are disabled in the calendar — used for "no past
   * dates" and "start date must be after the deadline". */
  minDate?: Date;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={ariaLabel}
        className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start gap-1.5 font-normal", !value && "text-muted-foreground")}
      >
        <CalendarIcon className="size-3.5 shrink-0" aria-hidden="true" />
        {value ? format(value, "MMM d, yyyy") : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={(date) => {
            onChange(date ?? null);
            setOpen(false);
          }}
          disabled={minDate ? { before: minDate } : undefined}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
