import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { Link } from "react-router";
import { posterImage, wideArtwork } from "@/api/images";
import { cardSubtitle, cardTitle, progress } from "@/lib/format";
import { cn } from "@/lib/cn";
import { itemHref } from "@/lib/routes";
import { Artwork, type ArtworkShape } from "./Artwork";
import { ProgressBar } from "./ProgressBar";

interface CardProps {
  item: BaseItemDto;
  className?: string;
  /** Override the second line. */
  subtitle?: string | null;
  priority?: boolean;
}

const CARD_LINK =
  "group block rounded-md focus-visible:outline-offset-4 [&_img]:transition-transform [&_img]:duration-300 [&_img]:ease-out hover:[&_img]:scale-[1.03]";

function CardText({ title, subtitle }: { title: string; subtitle?: string | null }) {
  return (
    <div className="mt-2 min-w-0">
      <p className="truncate text-label-md text-on-surface" title={title}>
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
export function PosterCard({ item, className, subtitle, priority }: CardProps) {
  const title = cardTitle(item);
  const shape: ArtworkShape =
    item.Type === "MusicAlbum" || item.Type === "Audio" ? "square" : "poster";
  const watched = progress(item);
  return (
    <Link to={itemHref(item)} className={cn(CARD_LINK, className)}>
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
  );
}

/** 16:9 card for episodes, home videos and Continue Watching. */
export function LandscapeCard({
  item,
  className,
  subtitle,
  priority,
  width = 320,
}: CardProps & { width?: number }) {
  const title = cardTitle(item);
  const watched = progress(item);
  const artwork = wideArtwork(item);
  return (
    <Link to={itemHref(item)} className={cn(CARD_LINK, className)}>
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
      <CardText title={title} subtitle={subtitle === undefined ? cardSubtitle(item) : subtitle} />
    </Link>
  );
}
