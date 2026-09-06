"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, GraduationCap } from "lucide-react";

/**
 * Searchable single-select institution combobox — same Popover+Command
 * shape as LocationCombobox. Used for the verified Qatar higher-ed catalog
 * (institutions prop). "My institution isn't listed" always falls back to
 * free text — never blocks entry, never invents a match.
 */
export function InstitutionCombobox({
  value,
  onChange,
  institutions,
  placeholder = "Search institution…",
}: {
  value: string;
  onChange: (value: string) => void;
  institutions: readonly string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [customMode, setCustomMode] = useState(() => Boolean(value) && !institutions.includes(value));

  if (customMode) {
    return (
      <div className="space-y-1.5">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Institution name"
          className="flex h-9 w-full rounded-lg border border-gray-cool/60 bg-white px-2.5 text-sm text-navy focus-visible:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/30"
        />
        <button
          type="button"
          onClick={() => { setCustomMode(false); onChange(""); }}
          className="text-xs font-medium text-teal-ink hover:underline"
        >
          Search the institution list instead
        </button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={placeholder}
        className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between font-normal")}
      >
        <span className={cn("flex min-w-0 items-center gap-1.5", !value && "text-muted-foreground")}>
          <GraduationCap className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{value || placeholder}</span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No matching institution.</CommandEmpty>
            <CommandGroup>
              {institutions.map((institution) => (
                <CommandItem
                  key={institution}
                  value={institution}
                  onSelect={() => {
                    onChange(institution);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-3.5", value === institution ? "opacity-100" : "opacity-0")} />
                  {institution}
                </CommandItem>
              ))}
              <CommandItem
                value="my-institution-isnt-listed"
                onSelect={() => {
                  setCustomMode(true);
                  onChange("");
                  setQuery("");
                  setOpen(false);
                }}
              >
                My institution isn&apos;t listed
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
