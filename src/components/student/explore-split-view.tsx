"use client";

import { useState, useTransition } from "react";
import { ExploreOpportunityCard } from "./explore-opportunity-card";
import { ExploreDetailPanel, type OpportunityDetail } from "./explore-detail-panel";
import { getOpportunityDetailAction } from "@/lib/opportunities/detail-actions";

export interface ExploreListItem {
  id: string;
  role: string;
  companyName: string;
  companyVerified: boolean;
  shortDescription: string | null;
  description: string;
  location: string;
  workMode: "remote" | "onsite" | "hybrid" | null;
  duration: string;
  hoursPerWeek: number;
  skills: string[];
  saved: boolean;
  isNew: boolean;
  estimatedMinutes?: number;
  matchScore?: number;
}

/**
 * True split-view (no dialog, no sheet): the left list is plain server-
 * rendered markup with real `<a>` links (so right-click / cmd-click "open
 * in new tab" keeps working); a plain left-click intercepts navigation and
 * updates the right panel with a server-action fetch instead — no Next.js
 * route transition happens at all for a row click, which is what makes
 * this immune to the router's own scroll/focus-reset behavior (see
 * scroll-preservation.ts's comment on the underlying bug this avoids by
 * simply never triggering a navigation in the first place).
 *
 * The URL still gets a real `?opportunity=` param via `history.pushState`
 * (not `router.push`) purely to keep the link shareable/refreshable — this
 * bypasses the App Router entirely, so it can never re-trigger the reset.
 */
export function ExploreSplitView({
  items,
  baseQueryString,
  initialSelectedId,
  initialDetail,
}: {
  items: ExploreListItem[];
  /** Current filter/sort query string, without `opportunity` — e.g. "location=Doha&sort=newest". */
  baseQueryString: string;
  initialSelectedId: string | null;
  initialDetail: OpportunityDetail | null;
}) {
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [detail, setDetail] = useState(initialDetail);
  const [isPending, startTransition] = useTransition();

  function hrefFor(id: string) {
    const params = new URLSearchParams(baseQueryString);
    params.set("opportunity", id);
    return `/student/opportunities?${params.toString()}`;
  }

  function selectOpportunity(id: string) {
    if (id === selectedId) return;
    setSelectedId(id);
    startTransition(async () => {
      const result = await getOpportunityDetailAction(id);
      setDetail(result);
      try {
        window.history.pushState(null, "", hrefFor(id));
      } catch {
        // Non-fatal — the right panel already updated; the URL just won't reflect it.
      }
    });
  }

  return (
    <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[400px_1fr] lg:items-start">
      <div className="space-y-2">
        {items.map((item) => (
          <ExploreOpportunityCard
            key={item.id}
            opportunity={item}
            href={hrefFor(item.id)}
            selected={item.id === selectedId}
            saved={item.saved}
            isNew={item.isNew}
            estimatedMinutes={item.estimatedMinutes}
            matchScore={item.matchScore}
            onSelect={() => selectOpportunity(item.id)}
          />
        ))}
      </div>
      <div className="lg:sticky lg:top-6 lg:h-[calc(100dvh-7rem)]">
        <ExploreDetailPanel detail={detail} loading={isPending} />
      </div>
    </div>
  );
}
