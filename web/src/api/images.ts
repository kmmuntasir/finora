import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";

export type ImageKind = "Primary" | "Backdrop" | "Thumb" | "Logo" | "Banner";

export interface ImageRef {
  itemId: string;
  kind: ImageKind;
  tag: string;
}

/**
 * URL for a Jellyfin image, resized on the server. Image endpoints need no
 * authentication, and the tag makes the URL cacheable forever.
 */
export function imageUrl(baseUrl: string, ref: ImageRef, maxWidth: number): string {
  const params = new URLSearchParams({
    tag: ref.tag,
    maxWidth: String(Math.round(maxWidth)),
    quality: "90",
  });
  return `${baseUrl}/Items/${ref.itemId}/Images/${ref.kind}?${params.toString()}`;
}

function own(item: BaseItemDto, kind: Exclude<ImageKind, "Backdrop">): ImageRef | null {
  const tag = item.ImageTags?.[kind];
  return item.Id && tag ? { itemId: item.Id, kind, tag } : null;
}

/** Portrait artwork: the item's poster, or for episodes the series poster. */
export function posterImage(item: BaseItemDto): ImageRef | null {
  if (item.Type === "Episode" && item.SeriesId && item.SeriesPrimaryImageTag) {
    return { itemId: item.SeriesId, kind: "Primary", tag: item.SeriesPrimaryImageTag };
  }
  return own(item, "Primary");
}

/** Wide background artwork, falling back to the parent's (series) backdrop. */
export function backdropImage(item: BaseItemDto): ImageRef | null {
  const ownTag = item.BackdropImageTags?.[0];
  if (item.Id && ownTag) return { itemId: item.Id, kind: "Backdrop", tag: ownTag };
  const parentTag = item.ParentBackdropImageTags?.[0];
  if (item.ParentBackdropItemId && parentTag) {
    return { itemId: item.ParentBackdropItemId, kind: "Backdrop", tag: parentTag };
  }
  return null;
}

/**
 * 16:9 artwork for landscape cards. Episodes and home videos use their own
 * frame grab first; films use a thumb or backdrop.
 */
export function landscapeImage(item: BaseItemDto): ImageRef | null {
  const isFrameGrab = item.Type === "Episode" || item.Type === "Video";
  if (isFrameGrab) {
    const primary = own(item, "Primary");
    if (primary) return primary;
  }
  const thumb = own(item, "Thumb");
  if (thumb) return thumb;
  if (item.ParentThumbItemId && item.ParentThumbImageTag) {
    return { itemId: item.ParentThumbItemId, kind: "Thumb", tag: item.ParentThumbImageTag };
  }
  return backdropImage(item);
}

export function logoImage(item: BaseItemDto): ImageRef | null {
  const ownLogo = own(item, "Logo");
  if (ownLogo) return ownLogo;
  if (item.ParentLogoItemId && item.ParentLogoImageTag) {
    return { itemId: item.ParentLogoItemId, kind: "Logo", tag: item.ParentLogoImageTag };
  }
  return null;
}

/**
 * Artwork for a 16:9 frame, following Jellyfin's own fallback order: wide
 * artwork if any, otherwise the item's Primary image (its poster, or for
 * videos without one, the frame Jellyfin extracted while indexing), shown
 * letterboxed rather than cropped.
 */
export function wideArtwork(
  item: BaseItemDto,
  preferBackdrop = false,
): { image: ImageRef | null; letterbox: boolean } {
  const wide = preferBackdrop
    ? (backdropImage(item) ?? landscapeImage(item))
    : landscapeImage(item);
  if (wide) return { image: wide, letterbox: false };
  return { image: posterImage(item), letterbox: true };
}
