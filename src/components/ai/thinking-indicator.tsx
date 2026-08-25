import { Sparkles } from "lucide-react";

export function ThinkingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-teal/25 bg-teal/5 px-4 py-3 text-sm text-navy">
      <Sparkles className="size-4 animate-pulse text-teal" />
      <span>{label}</span>
      <span className="flex gap-0.5">
        <span className="size-1 animate-bounce rounded-full bg-teal [animation-delay:-0.3s]" />
        <span className="size-1 animate-bounce rounded-full bg-teal [animation-delay:-0.15s]" />
        <span className="size-1 animate-bounce rounded-full bg-teal" />
      </span>
    </div>
  );
}
