import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { Check, Heart } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Virtuoso, VirtuosoGrid } from "react-virtuoso";
import { posterImage } from "@/api/images";
import { Artwork, type ArtworkShape } from "@/components/media/Artwork";
import { LandscapeCard, PosterCard } from "@/components/media/cards";
import { ProgressBar } from "@/components/media/ProgressBar";
import { cn } from "@/lib/cn";
import { cardSubtitle, cardTitle, progress, runtime } from "@/lib/format";
import { itemHref } from "@/lib/routes";
import type { ViewMode } from "./library-config";
import { t, tn } from "@/i18n";

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
  mode?: ViewMode;
  hasMore: boolean;
  onLoadMore: () => void;
  /** Link target for folder items (folder libraries). */
  folderHref?: (item: BaseItemDto) => string;
  /** When set, tapping a card toggles its selection instead of opening it. */
  selection?: { ids: Set<string>; toggle: (item: BaseItemDto) => void };
}

/** Virtualised grid or list: only items near the viewport are rendered, so large libraries stay fast. */
export function ItemGrid({
  items,
  shape,
  mode = "grid",
  hasMore,
  onLoadMore,
  folderHref,
  selection,
}: ItemGridProps) {
  // Load the next page a little before the end is visible.
  const rangeChanged = ({ endIndex }: { endIndex: number }) => {
    if (hasMore && endIndex >= items.length - 30) onLoadMore();
  };
  const wrap = (item: BaseItemDto, card: ReactNode) =>
    selection ? (
      <Selectable item={item} selected={selection.ids.has(item.Id!)} onToggle={selection.toggle}>
        {card}
      </Selectable>
    ) : (
      card
    );

  if (mode === "list") {
    return (
      <Virtuoso
        useWindowScroll
        totalCount={items.length}
        overscan={600}
        rangeChanged={rangeChanged}
        computeItemKey={(index) => items[index]?.Id ?? index}
        itemContent={(index) => {
          const item = items[index];
          if (!item) return null;
          const href = item.IsFolder && folderHref ? folderHref(item) : itemHref(item);
          return wrap(item, <ListRow item={item} href={href} square={shape === "square"} />);
        }}
      />
    );
  }

  const landscape = mode === "thumbs" || shape === "landscape";
  return (
    <VirtuosoGrid
      useWindowScroll
      totalCount={items.length}
      overscan={600}
      listClassName={cn("grid gap-x-4 gap-y-6", MIN_WIDTH[landscape ? "landscape" : shape])}
      rangeChanged={rangeChanged}
      computeItemKey={(index) => items[index]?.Id ?? index}
      itemContent={(index) => {
        const item = items[index];
        if (!item) return null;
        const href = item.IsFolder && folderHref ? folderHref(item) : undefined;
        return wrap(
          item,
          landscape ? (
            <LandscapeCard
              item={item}
              href={href}
              width={300}
              subtitle={item.IsFolder ? folderLabel(item) : cardSubtitle(item)}
            />
          ) : (
            <PosterCard item={item} href={href} />
          ),
        );
      }}
    />
  );
}

/** Covers the card with a toggle so a tap selects rather than navigates. */
function Selectable({
  item,
  selected,
  onToggle,
  children,
}: {
  item: BaseItemDto;
  selected: boolean;
  onToggle: (item: BaseItemDto) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <div className={cn("transition-opacity", !selected && "opacity-80")}>{children}</div>
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={t("Select {title}", { title: cardTitle(item) })}
        onClick={() => onToggle(item)}
        className={cn(
          "absolute inset-0 rounded-md ring-inset",
          selected ? "ring-3 ring-primary" : "hover:ring-2 hover:ring-white/40",
        )}
      >
        <span
          className={cn(
            "absolute top-2 left-2 grid size-7 place-items-center rounded-full ring-2",
            selected
              ? "bg-primary text-on-primary ring-primary"
              : "bg-black/50 text-transparent ring-white/70",
          )}
        >
          <Check aria-hidden className="size-4" strokeWidth={3} />
        </span>
      </button>
    </div>
  );
}

function ListRow({ item, href, square }: { item: BaseItemDto; href: string; square: boolean }) {
  const watched = progress(item);
  const meta = [
    item.ProductionYear,
    item.OfficialRating,
    runtime(item),
    item.CommunityRating ? `★ ${item.CommunityRating.toFixed(1)}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  return (
    <Link
      to={href}
      className="flex items-center gap-4 border-b border-border/60 py-2.5 hover:bg-white/5 light:hover:bg-black/5"
    >
      <div className={cn("relative shrink-0", square ? "w-14" : "w-12")}>
        <Artwork
          image={posterImage(item)}
          shape={square ? "square" : "poster"}
          width={96}
          title={cardTitle(item)}
          className="rounded-sm"
        />
        {watched !== null && (
          <ProgressBar value={watched} className="absolute inset-x-1 bottom-1 h-0.5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-label-md">
          {cardTitle(item)}
          {item.UserData?.IsFavorite && (
            <Heart
              aria-label={t("Favourite")}
              className="ml-2 inline size-3.5 fill-current text-error"
            />
          )}
        </p>
        <p className="truncate text-body-sm text-on-surface-muted">{meta || cardSubtitle(item)}</p>
        {item.Genres?.length ? (
          <p className="hidden truncate text-caption text-on-surface-subtle md:block">
            {item.Genres.slice(0, 3).join(", ")}
          </p>
        ) : null}
      </div>
      {item.UserData?.Played && (
        <Check aria-label={t("Watched")} className="size-5 shrink-0 text-success" strokeWidth={3} />
      )}
    </Link>
  );
}

function folderLabel(item: BaseItemDto): string | null {
  const count = item.ChildCount;
  if (count == null) return t("Folder");
  return tn(count, "{count} item", "{count} items");
}
