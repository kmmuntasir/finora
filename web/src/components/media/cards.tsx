import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { Link } from "react-router";
import { posterImage, wideArtwork } from "@/api/images";
import { cardSubtitle, cardTitle, progress } from "@/lib/format";
import { cn } from "@/lib/cn";
import { itemHref } from "@/lib/routes";
import { CardPlayButton } from "@/features/item/CardPlayButton";
import { Artwork } from "./Artwork";
import { ASPECT, type ArtworkShape } from "./aspect";
import { ProgressBar } from "./ProgressBar";

interface CardProps {
  item: BaseItemDto;
  className?: string;
  /** Override the second line. */
  subtitle?: string | null;
  /** Override the link target (folders open in the library view). */
  href?: string;
  priority?: boolean;
}

const CARD = "group relative";
const CARD_LINK =
  "block rounded-md focus-visible:outline-offset-4 [&_img]:transition-transform [&_img]:duration-300 [&_img]:ease-out group-hover:[&_img]:scale-[1.03]";

/** Centres the play button on the artwork; it sits beside the link, not inside it. */
function PlayOverlay({ item, shape }: { item: BaseItemDto; shape: ArtworkShape }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 grid place-items-center",
        ASPECT[shape],
      )}
    >
      <CardPlayButton item={item} />
    </div>
  );
}

function CardText({
  title,
  subtitle,
  lines = 1,
}: {
  title: string;
  subtitle?: string | null;
  lines?: 1 | 2;
}) {
  return (
    <div className="mt-2 min-w-0">
      <p
        className={cn("text-label-md text-on-surface", lines === 2 ? "line-clamp-2" : "truncate")}
        title={title}
      >
        {title}
      </p>
      {subtitle && (
        <p className="truncate text-caption text-on-surface-muted" title={subtitle}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

/** 2:3 poster (films, series) or 1:1 (albums). */
export function PosterCard({ item, className, subtitle, priority, href }: CardProps) {
  const title = cardTitle(item);
  const shape: ArtworkShape =
    item.Type === "MusicAlbum" || item.Type === "Audio" ? "square" : "poster";
  const watched = progress(item);
  return (
    <div className={cn(CARD, className)}>
      <Link to={href ?? itemHref(item)} className={CARD_LINK}>
        <div className="relative">
          <Artwork
            image={posterImage(item)}
            shape={shape}
            width={180}
            title={title}
            priority={priority}
            className="rounded-md"
          />
          {watched !== null && (
            <ProgressBar value={watched} className="absolute inset-x-2 bottom-2" />
          )}
        </div>
        <CardText title={title} subtitle={subtitle === undefined ? cardSubtitle(item) : subtitle} />
      </Link>
      <PlayOverlay item={item} shape={shape} />
    </div>
  );
}

/** 16:9 card for episodes, home videos and Continue Watching. */
export function LandscapeCard({
  item,
  className,
  subtitle,
  priority,
  href,
  width = 320,
}: CardProps & { width?: number }) {
  const title = cardTitle(item);
  const watched = progress(item);
  const artwork = wideArtwork(item);
  return (
    <div className={cn(CARD, className)}>
      <Link to={href ?? itemHref(item)} className={CARD_LINK}>
        <div className="relative">
          <Artwork
            image={artwork.image}
            letterbox={artwork.letterbox}
            shape="landscape"
            width={width}
            title={title}
            priority={priority}
            className="rounded-md"
          />
          {watched !== null && (
            <ProgressBar value={watched} className="absolute inset-x-3 bottom-3" />
          )}
        </div>
        <CardText
          lines={2}
          title={title}
          subtitle={subtitle === undefined ? cardSubtitle(item) : subtitle}
        />
      </Link>
      <PlayOverlay item={item} shape="landscape" />
    </div>
  );
}
