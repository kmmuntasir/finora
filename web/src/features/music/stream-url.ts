import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { getDeviceId } from "@/api/device";
import type { ImageRef } from "@/api/images";
import { mediaSupport } from "@/features/player/playback";
import type { QueueEntry } from "./queue-store";

/** Containers the browser plays as-is; everything else is converted to MP3 by the server. */
function directContainers(): string {
  const { audio } = mediaSupport();
  return [
    "mp3",
    audio.aac && "aac,m4a|aac,m4b|aac",
    audio.flac && "flac",
    audio.alac && "m4a|alac",
    audio.opus && "opus,webm|opus,ogg|opus",
    audio.vorbis && "ogg|vorbis,webma",
    "wav",
  ]
    .filter(Boolean)
    .join(",");
}

/** Jellyfin's universal audio endpoint: original file when possible, otherwise an MP3 stream. */
export function audioStreamUrl(
  baseUrl: string,
  entry: QueueEntry,
  userId: string,
  token: string,
): string {
  const params = new URLSearchParams({
    UserId: userId,
    DeviceId: getDeviceId(),
    MaxStreamingBitrate: "320000000",
    Container: directContainers(),
    TranscodingContainer: "mp3",
    TranscodingProtocol: "http",
    AudioCodec: "mp3",
    PlaySessionId: entry.key,
    ApiKey: token,
    EnableRedirection: "true",
    EnableRemoteMedia: "false",
  });
  return `${baseUrl}/Audio/${entry.item.Id}/universal?${params.toString()}`;
}

/** Artwork for a track: its own image, otherwise its album's. */
export function trackArt(item: BaseItemDto): ImageRef | null {
  const own = item.ImageTags?.Primary;
  if (item.Id && own) return { itemId: item.Id, kind: "Primary", tag: own };
  if (item.AlbumId && item.AlbumPrimaryImageTag) {
    return { itemId: item.AlbumId, kind: "Primary", tag: item.AlbumPrimaryImageTag };
  }
  return null;
}
