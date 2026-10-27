import type { BaseItemDto, TrickplayInfoDto } from "@jellyfin/sdk/lib/generated-client/models";

export interface TrickplayFrame {
  url: string;
  /** CSS background properties that crop the tile sheet to one thumbnail. */
  width: number;
  height: number;
  backgroundPosition: string;
  backgroundSize: string;
}

/** Picks the trickplay resolution (Jellyfin stores one per configured width). */
export function trickplayInfo(
  item: BaseItemDto,
  mediaSourceId: string | undefined,
): TrickplayInfoDto | null {
  const perSource = item.Trickplay?.[mediaSourceId ?? ""] ?? Object.values(item.Trickplay ?? {})[0];
  if (!perSource) return null;
  const options = Object.values(perSource).sort((a, b) => (a.Width ?? 0) - (b.Width ?? 0));
  return options.find((info) => (info.Width ?? 0) >= 240) ?? options[options.length - 1] ?? null;
}

export function trickplayFrame(
  info: TrickplayInfoDto,
  seconds: number,
  baseUrl: string,
  itemId: string,
  mediaSourceId: string,
  accessToken: string,
): TrickplayFrame | null {
  const {
    Width: width,
    Height: height,
    TileWidth: cols,
    TileHeight: rows,
    Interval: interval,
    ThumbnailCount: count,
  } = info;
  if (!width || !height || !cols || !rows || !interval || !count) return null;
  const index = Math.min(count - 1, Math.max(0, Math.floor((seconds * 1000) / interval)));
  const perSheet = cols * rows;
  const sheet = Math.floor(index / perSheet);
  const offset = index % perSheet;
  const x = (offset % cols) * width;
  const y = Math.floor(offset / cols) * height;
  const params = new URLSearchParams({ mediaSourceId, ApiKey: accessToken });
  return {
    url: `${baseUrl}/Videos/${itemId}/Trickplay/${width}/${sheet}.jpg?${params.toString()}`,
    width,
    height,
    backgroundPosition: `-${x}px -${y}px`,
    backgroundSize: `${cols * width}px ${rows * height}px`,
  };
}
