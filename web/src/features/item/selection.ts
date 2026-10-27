import type { BaseItemDto, MediaSourceInfo } from "@jellyfin/sdk/lib/generated-client/models";

export interface PlaySelection {
  sourceId?: string;
  audioIndex?: number;
  subtitleIndex?: number;
}

export function playHref(
  item: BaseItemDto,
  selection: PlaySelection = {},
  fromStart = false,
): string {
  const params = new URLSearchParams();
  if (selection.sourceId) params.set("source", selection.sourceId);
  if (selection.audioIndex !== undefined) params.set("audio", String(selection.audioIndex));
  if (selection.subtitleIndex !== undefined) params.set("sub", String(selection.subtitleIndex));
  if (fromStart) params.set("start", "0");
  const query = params.toString();
  return `/play/${item.Id}${query ? `?${query}` : ""}`;
}

export function selectedSource(
  item: BaseItemDto,
  selection: PlaySelection,
): MediaSourceInfo | undefined {
  const sources = item.MediaSources ?? [];
  return sources.find((source) => source.Id === selection.sourceId) ?? sources[0];
}
