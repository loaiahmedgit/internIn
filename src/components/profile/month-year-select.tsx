"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MONTHS = [
  { value: "01", label: "January" }, { value: "02", label: "February" }, { value: "03", label: "March" },
  { value: "04", label: "April" }, { value: "05", label: "May" }, { value: "06", label: "June" },
  { value: "07", label: "July" }, { value: "08", label: "August" }, { value: "09", label: "September" },
  { value: "10", label: "October" }, { value: "11", label: "November" }, { value: "12", label: "December" },
];

function parse(value: string | null | undefined): { year: string; month: string } {
  if (!value) return { year: "", month: "" };
  const [year, month] = value.split("-");
  return { year: year ?? "", month: month ?? "" };
}

/**
 * Two Selects (Month + Year) replacing native <input type="month">.
 * Stores/emits the exact same "YYYY-MM" string format the native control
 * already produced — pure control swap, no schema/format change.
 */
export function MonthYearSelect({
  value,
  onChange,
  minYear,
  maxYear,
  disabled,
}: {
  value: string | null;
  onChange: (value: string) => void;
  minYear: number;
  maxYear: number;
  disabled?: boolean;
}) {
  const { year, month } = parse(value);
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);

  function update(nextYear: string, nextMonth: string) {
    if (nextYear && nextMonth) onChange(`${nextYear}-${nextMonth}`);
  }

  return (
    <div className="flex gap-2">
      <Select value={month} onValueChange={(m) => m && update(year || String(maxYear), m)} disabled={disabled}>
        <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="Month" /></SelectTrigger>
        <SelectContent>
          {MONTHS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={year} onValueChange={(y) => y && update(y, month || "01")} disabled={disabled}>
        <SelectTrigger className="h-9 w-28"><SelectValue placeholder="Year" /></SelectTrigger>
        <SelectContent>
          {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Standalone Year-only select — used for graduation year. Range is always
 * computed from the current calendar year at render, never hardcoded. */
export function YearSelect({
  value,
  onChange,
  minYear,
  maxYear,
  placeholder = "Select year",
}: {
  value: number | null;
  onChange: (value: number) => void;
  minYear: number;
  maxYear: number;
  placeholder?: string;
}) {
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);
  return (
    <Select value={value ? String(value) : ""} onValueChange={(v) => v && onChange(Number(v))}>
      <SelectTrigger className="h-9 w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
