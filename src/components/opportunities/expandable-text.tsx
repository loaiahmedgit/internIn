"use client";

import { useState } from "react";

/** Plain expand/collapse for a long block of real text (a challenge
 * scenario, a resource description) — never truncates by generating new
 * content, just clamps and reveals the same text that's already there.
 * Fixed at a 3-line clamp: Tailwind's line-clamp utility needs a static
 * class name, not an interpolated one, to survive the JIT scan. */
export function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <p className={`whitespace-pre-wrap text-sm leading-6 text-navy/72 ${expanded ? "" : "line-clamp-3"}`}>{text}</p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 text-xs font-medium text-teal-ink hover:underline"
      >
        {expanded ? "Show less" : "Read more"}
      </button>
    </div>
  );
}
