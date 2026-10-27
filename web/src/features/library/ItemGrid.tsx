import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { VirtuosoGrid } from "react-virtuoso";
import type { ArtworkShape } from "@/components/media/Artwork";
import { LandscapeCard, PosterCard } from "@/components/media/cards";
import { cn } from "@/lib/cn";

const MIN_WIDTH: Record<ArtworkShape, string> = {
  poster:
    "grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] md:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]",
  square:
    "grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] md:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]",
  landscape:
    "grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] md:grid-cols-[repeat(auto-fill,minmax(17rem,1fr))]",
};

interface ItemGridProps {
  items: BaseItemDto[];
  shape: ArtworkShape;
  hasMore: boolean;
  onLoadMore: () => void;
  /** Link target for folder items (folder libraries). */
  folderHref?: (item: BaseItemDto) => string;
}

/** Virtualised grid: only cards near the viewport are rendered, so large libraries stay fast. */
export function ItemGrid({ items, shape, hasMore, onLoadMore, folderHref }: ItemGridProps) {
  return (
    <VirtuosoGrid
      useWindowScroll
      totalCount={items.length}
      overscan={600}
      listClassName={cn("grid gap-x-4 gap-y-6", MIN_WIDTH[shape])}
      // Load the next page a few rows before the end is visible.
      rangeChanged={({ endIndex }) => {
        if (hasMore && endIndex >= items.length - 30) onLoadMore();
      }}
      computeItemKey={(index) => items[index]?.Id ?? index}
      itemContent={(index) => {
        const item = items[index];
        if (!item) return null;
        const href = item.IsFolder && folderHref ? folderHref(item) : undefined;
        return shape === "landscape" ? (
          <LandscapeCard
            item={item}
            href={href}
            width={300}
            subtitle={item.IsFolder ? folderLabel(item) : undefined}
          />
        ) : (
          <PosterCard item={item} href={href} />
        );
      }}
    />
  );
}

function folderLabel(item: BaseItemDto): string | null {
  const count = item.ChildCount;
  if (count == null) return "Folder";
  return `${count} ${count === 1 ? "item" : "items"}`;
}
