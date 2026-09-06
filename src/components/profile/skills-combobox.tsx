"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SKILLS_CATALOG } from "@/lib/skills-catalog";

const MAX_SKILL_LENGTH = 60;

/**
 * Searchable multi-select skills combobox — replaces the old comma-
 * separated free-text Input. Same Popover+Command primitives as
 * LocationCombobox, extended for multi-select chips. Case-insensitive
 * search, dedupe, keyboard nav (cmdk's own arrow-key/Enter handling),
 * Backspace-to-remove-last-chip, and a custom-skill fallback that only
 * appears when nothing in the catalog matches.
 */
export function SkillsCombobox({
  value,
  onChange,
  placeholder = "Search skills…",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedLower = new Set(value.map((s) => s.toLowerCase()));
  const trimmedQuery = query.trim();
  const matches = trimmedQuery
    ? SKILLS_CATALOG.filter((skill) => skill.toLowerCase().includes(trimmedQuery.toLowerCase()) && !selectedLower.has(skill.toLowerCase()))
    : SKILLS_CATALOG.filter((skill) => !selectedLower.has(skill.toLowerCase())).slice(0, 30);
  const hasExactCatalogMatch = SKILLS_CATALOG.some((skill) => skill.toLowerCase() === trimmedQuery.toLowerCase());

  function addSkill(skill: string) {
    const trimmed = skill.trim().slice(0, MAX_SKILL_LENGTH);
    if (!trimmed) return;
    if (selectedLower.has(trimmed.toLowerCase())) {
      setQuery("");
      return;
    }
    onChange([...value, trimmed]);
    setQuery("");
  }

  function removeSkill(skill: string) {
    onChange(value.filter((s) => s !== skill));
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((skill) => (
            <span key={skill} className="inline-flex items-center gap-1 rounded-full border border-teal bg-teal/5 py-1 pl-3 pr-1.5 text-sm font-medium text-teal">
              {skill}
              <button
                type="button"
                onClick={() => removeSkill(skill)}
                aria-label={`Remove ${skill}`}
                className="rounded-full p-0.5 hover:bg-teal/15"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label="Search skills"
          className="flex h-9 w-full items-center rounded-lg border border-gray-cool/60 bg-white px-2.5 text-left text-sm text-navy/45 hover:border-teal/40 focus-visible:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/30"
        >
          {placeholder}
        </PopoverTrigger>
        <PopoverContent className="w-(--anchor-width) min-w-64 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={placeholder}
              value={query}
              onValueChange={setQuery}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && query === "" && value.length > 0) {
                  removeSkill(value[value.length - 1]);
                }
              }}
            />
            <CommandList>
              <CommandEmpty>No matching skill.</CommandEmpty>
              <CommandGroup>
                {matches.map((skill) => (
                  <CommandItem key={skill} value={skill} onSelect={() => addSkill(skill)}>
                    {skill}
                  </CommandItem>
                ))}
                {trimmedQuery.length > 0 && !hasExactCatalogMatch && (
                  <CommandItem value={`custom:${trimmedQuery}`} onSelect={() => addSkill(trimmedQuery)}>
                    Add &quot;{trimmedQuery}&quot; as custom skill
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
