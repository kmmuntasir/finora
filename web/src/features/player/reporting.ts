import type { Api } from "@jellyfin/sdk";
import { getHlsSegmentApi } from "@jellyfin/sdk/lib/utils/api/hls-segment-api";
import { getPlaystateApi } from "@jellyfin/sdk/lib/utils/api/playstate-api";
import { getDeviceId } from "@/api/device";
import type { PlaybackSource } from "./playback";

export interface PlaybackSnapshot {
  positionSeconds: number;
  isPaused: boolean;
  isMuted: boolean;
  volume: number;
  audioIndex: number | undefined;
  subtitleIndex: number | undefined;
  playbackRate: number;
}

const TICKS_PER_SECOND = 10_000_000;

function body(itemId: string, source: PlaybackSource, snapshot: PlaybackSnapshot) {
  return {
    ItemId: itemId,
    MediaSourceId: source.mediaSource.Id,
    PlaySessionId: source.playSessionId,
    PlayMethod: source.method,
    PositionTicks: Math.round(snapshot.positionSeconds * TICKS_PER_SECOND),
    IsPaused: snapshot.isPaused,
    IsMuted: snapshot.isMuted,
    VolumeLevel: Math.round(snapshot.volume * 100),
    AudioStreamIndex: snapshot.audioIndex,
    SubtitleStreamIndex: snapshot.subtitleIndex ?? -1,
    CanSeek: true,
  };
}

/**
 * Tells Jellyfin what is playing so resume positions, "watched" state and the
 * admin's session list stay correct on every client.
 */
export function createReporter(api: Api, itemId: string, source: PlaybackSource) {
  const playstate = getPlaystateApi(api);
  let started = false;
  let stopped = false;

  return {
    start(snapshot: PlaybackSnapshot) {
      if (started) return;
      started = true;
      void playstate
        .reportPlaybackStart({ playbackStartInfo: body(itemId, source, snapshot) })
        .catch(() => undefined);
    },
    progress(snapshot: PlaybackSnapshot) {
      if (!started || stopped) return;
      void playstate
        .reportPlaybackProgress({ playbackProgressInfo: body(itemId, source, snapshot) })
        .catch(() => undefined);
    },
    /** `unloading` uses a keepalive fetch so the report survives closing the tab. */
    stop(snapshot: PlaybackSnapshot, unloading = false) {
      if (!started || stopped) return;
      stopped = true;
      const stopInfo = body(itemId, source, snapshot);
      if (unloading) {
        void fetch(`${api.basePath}/Sessions/Playing/Stopped`, {
          method: "POST",
          keepalive: true,
          headers: { Authorization: api.authorizationHeader, "Content-Type": "application/json" },
          body: JSON.stringify(stopInfo),
        }).catch(() => undefined);
      } else {
        void playstate.reportPlaybackStopped({ playbackStopInfo: stopInfo }).catch(() => undefined);
      }
      if (source.method !== "DirectPlay" && source.playSessionId) {
        // Free the server's ffmpeg process right away instead of waiting for its timeout.
        void getHlsSegmentApi(api)
          .stopEncodingProcess({ deviceId: getDeviceId(), playSessionId: source.playSessionId })
          .catch(() => undefined);
      }
    },
  };
}

export type Reporter = ReturnType<typeof createReporter>;
