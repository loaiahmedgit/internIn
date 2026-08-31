import { Skeleton } from "@/components/ui/skeleton";

/**
 * Matches AssistantWorkspace's real empty state (the only state a fresh
 * navigation ever lands on): centered heading/subtitle, a composer-shaped
 * bar, and a row of suggestion-pill placeholders.
 */
export default function AssistantLoading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col px-6 py-16">
      <div className="flex flex-col items-center text-center">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="mt-8 h-28 w-full rounded-2xl" />
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-36 rounded-full" />
        ))}
      </div>
    </div>
  );
}
