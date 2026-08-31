"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";

/** A plain add/remove list of short strings — used for requirements, nice-to-have, application questions, and skills. One shared component so all four behave and look identical. */
export function TagListEditor({
  items,
  onChange,
  placeholder = "Add item",
  emptyHint,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  emptyHint?: string;
}) {
  const [value, setValue] = useState("");

  function add() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onChange([...items, trimmed]);
    setValue("");
  }

  return (
    <div className="space-y-2">
      {items.length === 0 && emptyHint && <p className="text-xs text-navy/45">{emptyHint}</p>}
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={`${item}-${i}`} className="flex items-start gap-2 rounded-lg border border-navy/10 bg-white px-3 py-2 text-sm text-navy">
              <span className="min-w-0 flex-1 break-words">{item}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, index) => index !== i))}
                aria-label={`Remove ${item}`}
                className="shrink-0 text-navy/40 hover:text-red-600"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="h-8"
        />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!value.trim()}>
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>
    </div>
  );
}
