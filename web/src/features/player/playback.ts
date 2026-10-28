import type { Api } from "@jellyfin/sdk";
import type {
  MediaSourceInfo,
  MediaStream,
  PlaybackInfoResponse,
} from "@jellyfin/sdk/lib/generated-client/models";
import { getMediaInfoApi } from "@jellyfin/sdk/lib/utils/api/media-info-api";
import { getDeviceId } from "@/api/device";
import {
  browserProbe,
  buildDeviceProfile,
  detectSupport,
  type MediaSupport,
} from "./device-profile";
import { t } from "@/i18n";

export type PlayMethod = "DirectPlay" | "DirectStream" | "Transcode";

export interface SubtitleTrack {
  index: number;
  label: string;
  language: string | undefined;
  /** WebVTT URL for text subtitles; null for subtitles that must be burned in. */
  url: string | null;
  /** Original ASS/SSA file, rendered with JASSUB when possible (styling, positioning, fonts). */
  assUrl?: string | null;
  isForced: boolean;
}

export interface AudioTrack {
  index: number;
  label: string;
  language: string | undefined;
}

export interface PlaybackSource {
  url: string;
  isHls: boolean;
  method: PlayMethod;
  playSessionId: string;
  mediaSource: MediaSourceInfo;
  transcodeReasons: string[];
  audioTracks: AudioTrack[];
  subtitleTracks: SubtitleTrack[];
  /** Fonts embedded in the file (MKV attachments), for styled subtitles. */
  fontUrls: string[];
  /** Subtitle index burned into the video stream, if any. */
  burnedSubtitleIndex: number | null;
}

export interface PlaybackRequest {
  itemId: string;
  userId: string;
  mediaSourceId?: string;
  audioIndex?: number;
  subtitleIndex?: number;
  startTicks: number;
  maxBitrate: number;
  /** Skip direct play (used after the browser failed to play the original file). */
  forceStream?: boolean;
}

let cachedSupport: MediaSupport | undefined;
export function mediaSupport(): MediaSupport {
  cachedSupport ??= {
    ...detectSupport(browserProbe()),
    styledSubtitles:
      typeof WebAssembly === "object" &&
      typeof OffscreenCanvas !== "undefined" &&
      "requestVideoFrameCallback" in HTMLVideoElement.prototype,
  };
  return cachedSupport;
}

// Only a container change keeps the original streams; any bitrate cap forces re-encoding.
const CONTAINER_ONLY_REASONS = new Set(["ContainerNotSupported"]);

export function absoluteUrl(baseUrl: string, path: string): string {
  return /^https?:\/\//.test(path) ? path : `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

function streamLabel(stream: MediaStream): string {
  return (
    stream.DisplayTitle ??
    stream.Title ??
    stream.Language ??
    t("Track {number}", { number: stream.Index ?? "" })
  );
}

/** Interprets a PlaybackInfo response into something the <video> element can play. */
export function resolveSource(
  response: PlaybackInfoResponse,
  request: PlaybackRequest,
  baseUrl: string,
  accessToken: string,
): PlaybackSource {
  const sources = response.MediaSources ?? [];
  const mediaSource = sources.find((source) => source.Id === request.mediaSourceId) ?? sources[0];
  if (!mediaSource?.Id) throw new Error(t("The server returned no playable version of this item."));
  const playSessionId = response.PlaySessionId ?? "";
  const streams = mediaSource.MediaStreams ?? [];

  let url: string;
  let isHls = false;
  let method: PlayMethod;
  let transcodeReasons: string[] = [];

  if (mediaSource.SupportsDirectPlay && !request.forceStream) {
    const container = (mediaSource.Container ?? "mp4").split(",")[0];
    const params = new URLSearchParams({
      Static: "true",
      mediaSourceId: mediaSource.Id,
      deviceId: getDeviceId(),
      PlaySessionId: playSessionId,
      ApiKey: accessToken,
    });
    if (mediaSource.ETag) params.set("Tag", mediaSource.ETag);
    url = `${baseUrl}/Videos/${request.itemId}/stream.${container}?${params.toString()}`;
    method = "DirectPlay";
  } else if (mediaSource.TranscodingUrl) {
    url = absoluteUrl(baseUrl, mediaSource.TranscodingUrl);
    isHls = mediaSource.TranscodingSubProtocol === "hls" || url.includes(".m3u8");
    const reasons = new URL(url).searchParams.get("TranscodeReasons");
    transcodeReasons = reasons ? reasons.split(",") : [];
    method =
      transcodeReasons.length > 0 &&
      transcodeReasons.every((reason) => CONTAINER_ONLY_REASONS.has(reason))
        ? "DirectStream"
        : "Transcode";
  } else {
    throw new Error(
      mediaSource.SupportsDirectPlay
        ? t("This browser could not play the original file, and the server offered no alternative.")
        : t("This file can't be played in this browser."),
    );
  }

  const burned = streams.find(
    (stream) =>
      stream.Type === "Subtitle" &&
      stream.DeliveryMethod === "Encode" &&
      stream.Index === request.subtitleIndex,
  );

  return {
    url,
    isHls,
    method,
    playSessionId,
    mediaSource,
    transcodeReasons,
    audioTracks: streams
      .filter((stream) => stream.Type === "Audio")
      .map((stream) => ({
        index: stream.Index ?? -1,
        label: streamLabel(stream),
        language: stream.Language ?? undefined,
      })),
    subtitleTracks: streams
      .filter((stream) => stream.Type === "Subtitle")
      .map((stream) => ({
        index: stream.Index ?? -1,
        label: streamLabel(stream),
        language: stream.Language ?? undefined,
        isForced: Boolean(stream.IsForced),
        assUrl:
          stream.IsTextSubtitleStream && ["ass", "ssa"].includes((stream.Codec ?? "").toLowerCase())
            ? `${baseUrl}/Videos/${request.itemId}/${mediaSource.Id}/Subtitles/${stream.Index}/0/Stream.ass?ApiKey=${encodeURIComponent(accessToken)}`
            : null,
        // ASS/SSA delivered "External" point at the .ass file; the WebVTT copy is the fallback.
        url:
          stream.DeliveryMethod === "External" &&
          stream.DeliveryUrl &&
          !["ass", "ssa"].includes((stream.Codec ?? "").toLowerCase())
            ? absoluteUrl(baseUrl, stream.DeliveryUrl)
            : !stream.IsTextSubtitleStream
              ? null
              : `${baseUrl}/Videos/${request.itemId}/${mediaSource.Id}/Subtitles/${stream.Index}/0/Stream.vtt?ApiKey=${encodeURIComponent(accessToken)}`,
      })),
    burnedSubtitleIndex: burned?.Index ?? null,
    fontUrls: (mediaSource.MediaAttachments ?? [])
      .filter(
        (attachment) =>
          /font|truetype|opentype/i.test(attachment.MimeType ?? "") ||
          /\.(ttf|otf|ttc|woff2?)$/i.test(attachment.FileName ?? ""),
      )
      .map(
        (attachment) =>
          `${baseUrl}/Videos/${request.itemId}/${mediaSource.Id}/Attachments/${attachment.Index}?ApiKey=${encodeURIComponent(accessToken)}`,
      ),
  };
}

/** Asks Jellyfin how to play an item with this browser's capabilities. */
export async function requestPlayback(
  api: Api,
  request: PlaybackRequest,
  signal?: AbortSignal,
): Promise<PlaybackSource> {
  const profile = buildDeviceProfile(mediaSupport(), request.maxBitrate);
  const { data } = await getMediaInfoApi(api).getPostedPlaybackInfo(
    {
      itemId: request.itemId,
      playbackInfoDto: {
        UserId: request.userId,
        DeviceProfile: profile,
        MaxStreamingBitrate: request.maxBitrate,
        StartTimeTicks: request.startTicks,
        MediaSourceId: request.mediaSourceId,
        AudioStreamIndex: request.audioIndex,
        SubtitleStreamIndex: request.subtitleIndex,
        EnableDirectPlay: !request.forceStream,
        EnableDirectStream: true,
        EnableTranscoding: true,
        AllowVideoStreamCopy: true,
        AllowAudioStreamCopy: true,
        AutoOpenLiveStream: true,
      },
    },
    { signal },
  );
  if (data.ErrorCode) {
    throw new Error(
      data.ErrorCode === "NotAllowed"
        ? t("Your account is not allowed to play this item.")
        : data.ErrorCode === "NoCompatibleStream"
          ? t("No compatible stream is available for this item.")
          : t("The server refused playback ({code}).", { code: data.ErrorCode }),
    );
  }
  return resolveSource(data, request, api.basePath, api.accessToken);
}
