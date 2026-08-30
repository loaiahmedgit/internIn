"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * A shadcn Select that drives a query param via router navigation — the
 * client-side equivalent of the zero-JS `<form method="get">` pattern used
 * elsewhere, needed here because shadcn's Select has no native form
 * auto-submit the way a plain `<select>` does.
 */
export function QuerySelect({
  param,
  value,
  options,
  className,
  resetParam,
  ariaLabel,
}: {
  param: string;
  value: string;
  options: { value: string; label: string }[];
  className?: string;
  ariaLabel?: string;
  /** Another param to drop whenever this one changes — e.g. "page", so picking a new filter/sort always lands back on page 1. */
  resetParam?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(next: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set(param, next);
    else params.delete(param);
    if (resetParam) params.delete(resetParam);
    router.push(`${pathname}?${params.toString()}`);
  }

  const labelByValue = new Map(options.map((o) => [o.value, o.label]));

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className={className} aria-label={ariaLabel}>
        <SelectValue>{(v: string) => labelByValue.get(v) ?? v}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
