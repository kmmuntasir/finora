import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/cn";
import { t } from "@/i18n";

interface MediaRowProps {
  title: string;
  seeAllHref?: string;
  children: ReactNode;
  /** Tailwind width classes applied to each item wrapper. */
  itemClassName: string;
  className?: string;
}

/** A titled, horizontally scrolling row with arrow buttons on pointer devices. */
export function MediaRow({ title, seeAllHref, children, itemClassName, className }: MediaRowProps) {
  const headingId = useId();
  const scroller = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const updateEdges = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    updateEdges();
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateEdges, children]);

  const scrollBy = (direction: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const items = Array.isArray(children) ? children : [children];

  return (
    <section aria-labelledby={headingId} className={cn("group/row", className)}>
      <div className="mb-3 flex items-end justify-between gap-4 px-page-x-mobile md:px-page-x">
        <h2 id={headingId} className="text-title">
          {title}
        </h2>
        <div className="flex items-center gap-1">
          {seeAllHref && (
            <Link
              to={seeAllHref}
              className="mr-2 text-label-md text-on-surface-muted hover:text-on-surface"
            >
              {t("See all")}
            </Link>
          )}
          {(["prev", "next"] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => scrollBy(dir === "prev" ? -1 : 1)}
              disabled={dir === "prev" ? edges.start : edges.end}
              aria-label={
                dir === "prev"
                  ? t("Scroll {title} back", { title })
                  : t("Scroll {title} forward", { title })
              }
              className="hidden size-8 place-items-center rounded-full bg-surface-overlay text-on-surface transition-opacity duration-[120ms] hover:bg-border disabled:opacity-30 [@media(pointer:fine)]:grid"
            >
              {dir === "prev" ? (
                <ChevronLeft className="size-5" />
              ) : (
                <ChevronRight className="size-5" />
              )}
            </button>
          ))}
        </div>
      </div>
      <ul
        ref={scroller}
        onScroll={updateEdges}
        className="flex snap-x snap-mandatory scroll-px-page-x-mobile gap-3 overflow-x-auto overscroll-x-contain px-page-x-mobile pb-2 [scrollbar-width:none] md:scroll-px-page-x md:gap-4 md:px-page-x [&::-webkit-scrollbar]:hidden"
      >
        {items.map((child, index) => (
          <li key={index} className={cn("shrink-0 snap-start", itemClassName)}>
            {child}
          </li>
        ))}
      </ul>
    </section>
  );
}
