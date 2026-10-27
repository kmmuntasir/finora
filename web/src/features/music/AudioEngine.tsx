import { useEffect, useMemo, useRef } from "react";
import { imageUrl } from "@/api/images";
import { useRuntimeConfig } from "@/config/context";
import { useSession } from "@/features/auth/context";
import { readPlayerPreferences, savePlayerPreferences } from "@/features/player/player-preferences";
import { createReporter, type PlaybackSnapshot, type Reporter } from "@/features/player/reporting";
import { useAudioClock } from "./audio-clock";
import { currentEntry, useQueue } from "./queue-store";
import { audioStreamUrl, trackArt } from "./stream-url";

const PROGRESS_INTERVAL_MS = 10_000;

/**
 * The single, app-wide <audio> element. Mounted once in the app shell so music
 * keeps playing while the user browses.
 */
export function AudioEngine() {
  const { api, user } = useSession();
  const { config } = useRuntimeConfig();
  const audioRef = useRef<HTMLAudioElement>(null);
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const reporterRef = useRef<Reporter | null>(null);

  const entry = useQueue(currentEntry);
  const nextEntry = useQueue(
    (state) =>
      state.queue[state.index + 1] ?? (state.repeat === "all" ? state.queue[0] : undefined),
  );
  const playing = useQueue((state) => state.playing);
  const restartToken = useQueue((state) => state.restartToken);

  const url = useMemo(
    () => (entry ? audioStreamUrl(config.jellyfinUrl, entry, user.Id!, api.accessToken) : null),
    [entry, config.jellyfinUrl, user.Id, api.accessToken],
  );

  const snapshot = (): PlaybackSnapshot => {
    const audio = audioRef.current;
    return {
      positionSeconds: audio?.currentTime ?? 0,
      isPaused: audio?.paused ?? true,
      isMuted: audio?.muted ?? false,
      volume: audio?.volume ?? 1,
      audioIndex: undefined,
      subtitleIndex: undefined,
      playbackRate: 1,
    };
  };

  // Wire the clock's controls to this element once.
  useEffect(() => {
    const preferences = readPlayerPreferences();
    const audio = audioRef.current!;
    audio.volume = preferences.volume;
    audio.muted = preferences.muted;
    useAudioClock.setState({
      volume: preferences.volume,
      muted: preferences.muted,
      seek: (seconds) => {
        audio.currentTime = Math.max(0, seconds);
        useAudioClock.setState({ current: audio.currentTime });
      },
      setVolume: (volume) => {
        audio.volume = Math.min(1, Math.max(0, volume));
        audio.muted = false;
        useAudioClock.setState({ volume: audio.volume, muted: false });
        savePlayerPreferences({ volume: audio.volume, muted: false });
      },
      toggleMute: () => {
        audio.muted = !audio.muted;
        useAudioClock.setState({ muted: audio.muted });
        savePlayerPreferences({ muted: audio.muted });
      },
    });
  }, []);

  // Load a new track (or restart the current one).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    reporterRef.current?.stop(snapshot());
    reporterRef.current = null;
    if (!entry || !url) {
      audio.removeAttribute("src");
      audio.load();
      return;
    }
    reporterRef.current = createReporter(api, entry.item.Id!, {
      mediaSourceId: entry.item.Id!,
      playSessionId: entry.key,
      method: "DirectPlay",
    });
    if (audio.src !== url) audio.src = url;
    audio.currentTime = 0;
    useAudioClock.setState({ current: 0, duration: (entry.item.RunTimeTicks ?? 0) / 10_000_000 });
    if (useQueue.getState().playing)
      void audio.play().catch(() => useQueue.getState().setPlaying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, restartToken]);

  // Play / pause requests from the UI.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (playing && audio.paused)
      void audio.play().catch(() => useQueue.getState().setPlaying(false));
    if (!playing && !audio.paused) audio.pause();
  }, [playing]);

  // Warm the browser cache with the next track for a smooth transition.
  useEffect(() => {
    if (!nextEntry || nextEntry === entry) return;
    const preload = new Audio();
    preload.preload = "auto";
    preload.src = audioStreamUrl(config.jellyfinUrl, nextEntry, user.Id!, api.accessToken);
    preloadRef.current = preload;
    return () => {
      preload.removeAttribute("src");
      preload.load();
    };
  }, [nextEntry, entry, config.jellyfinUrl, user.Id, api.accessToken]);

  // Progress reports while playing.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => reporterRef.current?.progress(snapshot()),
      PROGRESS_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    const onUnload = () => reporterRef.current?.stop(snapshot(), true);
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("pagehide", onUnload);
      reporterRef.current?.stop(snapshot());
    };
  }, []);

  // System media controls.
  useEffect(() => {
    if (!("mediaSession" in navigator) || !entry) return;
    const item = entry.item;
    const art = trackArt(item);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.Name ?? "",
      artist: item.Artists?.join(", ") ?? item.AlbumArtist ?? "",
      album: item.Album ?? "",
      artwork: art ? [{ src: imageUrl(config.jellyfinUrl, art, 512), sizes: "512x512" }] : [],
    });
    const queue = useQueue.getState();
    const handlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      ["play", () => queue.setPlaying(true)],
      ["pause", () => queue.setPlaying(false)],
      ["nexttrack", () => useQueue.getState().next()],
      ["previoustrack", () => useQueue.getState().previous()],
      [
        "seekto",
        (details) =>
          details.seekTime !== undefined && useAudioClock.getState().seek(details.seekTime),
      ],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Unsupported in this browser.
      }
    }
  }, [entry, config.jellyfinUrl]);

  return (
    <audio
      ref={audioRef}
      crossOrigin="anonymous"
      preload="auto"
      onPlay={() => useQueue.getState().setPlaying(true)}
      onPause={() => {
        if (!audioRef.current?.ended) useQueue.getState().setPlaying(false);
        reporterRef.current?.progress(snapshot());
      }}
      onPlaying={() => reporterRef.current?.start(snapshot())}
      onSeeked={() => reporterRef.current?.progress(snapshot())}
      onTimeUpdate={(event) => useAudioClock.setState({ current: event.currentTarget.currentTime })}
      onDurationChange={(event) => {
        const duration = event.currentTarget.duration;
        if (Number.isFinite(duration)) useAudioClock.setState({ duration });
      }}
      onEnded={() => {
        reporterRef.current?.stop(snapshot());
        useQueue.getState().next();
      }}
      onError={() => {
        // Skip unplayable tracks instead of stopping the whole queue.
        if (useQueue.getState().queue.length > 1) useQueue.getState().next();
        else useQueue.getState().setPlaying(false);
      }}
    />
  );
}
