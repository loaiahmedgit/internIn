"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A single horizontal row that scrolls instead of wrapping cards onto a
 * second row — arrows shift the row by roughly one card width. Multiple
 * cards stay visible at once; this is not a one-at-a-time slideshow.
 */
export function HorizontalScrollRow({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateArrows() {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => updateArrows();
    el.addEventListener("scroll", onScroll);
    const onResize = () => updateArrows();
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  function scrollByAmount(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  }

  return (
    <div className="relative">
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByAmount(-1)}
          aria-label="Scroll left"
          className="absolute top-1/2 -left-3 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-navy/10 bg-white text-navy/60 shadow-md transition-colors hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
      )}
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByAmount(1)}
          aria-label="Scroll right"
          className="absolute top-1/2 -right-3 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-navy/10 bg-white text-navy/60 shadow-md transition-colors hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
