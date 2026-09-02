"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";

/** A practical starting set for internIn's markets, not an exhaustive
 * geo dataset — GCC/MENA plus the other major hiring hubs the product
 * already references. Custom entry (see below) covers everything else. */
const COMMON_LOCATIONS = [
  "Doha, Qatar",
  "Dubai, United Arab Emirates",
  "Abu Dhabi, United Arab Emirates",
  "Riyadh, Saudi Arabia",
  "Jeddah, Saudi Arabia",
  "Kuwait City, Kuwait",
  "Manama, Bahrain",
  "Muscat, Oman",
  "Cairo, Egypt",
  "Amman, Jordan",
  "Beirut, Lebanon",
  "Istanbul, Türkiye",
  "London, United Kingdom",
  "New York, United States",
  "San Francisco, United States",
  "Toronto, Canada",
  "Berlin, Germany",
  "Paris, France",
  "Singapore",
  "Remote",
];

/**
 * Searchable location combobox (Popover + Command, both already installed
 * shadcn primitives) — replaces a plain text input / giant country
 * dropdown. Stores a canonical "City, Country" string; typing a value not
 * in the list offers it as a custom entry rather than blocking input.
 */
export function LocationCombobox({
  value,
  onChange,
  placeholder = "Search a city…",
  ariaLabel = "Location",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const exactMatch = COMMON_LOCATIONS.some((l) => l.toLowerCase() === query.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={ariaLabel}
        className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between font-normal")}
      >
        <span className={cn("flex min-w-0 items-center gap-1.5", !value && "text-muted-foreground")}>
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{value || placeholder}</span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No matching city.</CommandEmpty>
            <CommandGroup>
              {COMMON_LOCATIONS.map((location) => (
                <CommandItem
                  key={location}
                  value={location}
                  onSelect={() => {
                    onChange(location);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-3.5", value === location ? "opacity-100" : "opacity-0")} />
                  {location}
                </CommandItem>
              ))}
              {query.trim().length > 0 && !exactMatch && (
                <CommandItem
                  value={`custom:${query}`}
                  onSelect={() => {
                    onChange(query.trim());
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  Use &quot;{query.trim()}&quot;
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
