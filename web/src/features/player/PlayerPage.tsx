import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { useQuery } from "@tanstack/react-query";
import Hls from "hls.js";
import {
  ArrowLeft,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { backdropImage, imageUrl, landscapeImage, posterImage } from "@/api/images";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { useRuntimeConfig } from "@/config/context";
import { useSession } from "@/features/auth/context";
import { useItemDetails } from "@/features/item/queries";
import { useQueue } from "@/features/music/queue-store";
import { useItemSubtitles, useSubtitlesEnabled } from "@/features/subtitles/api";
import { cn } from "@/lib/cn";
import { episodeCode } from "@/lib/format";
import {
  requestPlayback,
  type PlaybackRequest,
  type PlaybackSource,
  type SubtitleTrack,
} from "./playback";
import { chooseInitialSubtitle } from "./subtitle-choice";
import { AudioMenu, CONTROL_BUTTON, SettingsMenu, SubtitleMenu } from "./PlayerMenus";
import { formatClock, readPlayerPreferences, savePlayerPreferences } from "./player-preferences";
import { useNextEpisode, useSegments, type SkippableSegment } from "./queries";
import { createReporter, type PlaybackSnapshot, type Reporter } from "./reporting";
import { SeekBar } from "./SeekBar";
import { trickplayFrame, trickplayInfo } from "./trickplay";

const TICKS_PER_SECOND = 10_000_000;
const PROGRESS_INTERVAL_MS = 10_000;
const CONTROLS_TIMEOUT_MS = 3000;
const UP_NEXT_SECONDS = 10;

export function PlayerPage() {
  const { itemId } = useParams();
  const { data: item, isPending, isError } = useItemDetails(itemId);
  const navigate = useNavigate();

  if (isPending) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-black">
        <Spinner label="Loading" />
      </div>
    );
  }
  if (isError || !item?.Id) {
    return (
      <PlayerError message="This item could not be loaded." onBack={() => void navigate(-1)} />
    );
  }
  if (!item.MediaSources?.length) {
    return (
      <PlayerError
        message={
          item.MediaType === "Audio" || item.Type === "MusicAlbum"
            ? "Music playback arrives with the music player."
            : "This item has nothing to play."
        }
        onBack={() => void navigate(-1)}
      />
    );
  }
  return <Player key={item.Id} item={item} />;
}

function PlayerError({
  message,
  onBack,
  onRetry,
}: {
  message: string;
  onBack: () => void;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="fixed inset-0 z-50 grid place-items-center bg-black px-page-x-mobile"
    >
      <div className="max-w-md text-center">
        <p className="text-title">Playback problem</p>
        <p className="mt-2 text-body-md text-on-surface-muted">{message}</p>
        <div className="mt-6 flex justify-center gap-2">
          {onRetry && <Button onClick={onRetry}>Try again</Button>}
          <Button variant="secondary" onClick={onBack}>
            Go back
          </Button>
        </div>
      </div>
    </div>
  );
}

function initialStartTicks(item: BaseItemDto, startParam: string | null): number {
  if (startParam !== null) return Math.max(0, Number(startParam) || 0) * TICKS_PER_SECOND;
  return item.UserData?.PlaybackPositionTicks ?? 0;
}

function Player({ item }: { item: BaseItemDto }) {
  const { api, user } = useSession();
  const { config } = useRuntimeConfig();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preferences = useMemo(() => readPlayerPreferences(), []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const reporterRef = useRef<Reporter | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);

  const [request, setRequest] = useState<PlaybackRequest>(() => ({
    itemId: item.Id!,
    userId: user.Id!,
    mediaSourceId: params.get("source") ?? undefined,
    audioIndex: params.has("audio") ? Number(params.get("audio")) : undefined,
    subtitleIndex: params.has("sub") ? Number(params.get("sub")) : undefined,
    startTicks: initialStartTicks(item, params.get("start")),
    maxBitrate: preferences.maxBitrate,
  }));

  const playback = useQuery({
    queryKey: ["playback", request],
    queryFn: ({ signal }) => requestPlayback(api, request, signal),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });
  const source = playback.data;

  const [subtitleIndex, setSubtitleIndex] = useState<number>(-1);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [current, setCurrent] = useState(request.startTicks / TICKS_PER_SECOND);
  const [duration, setDuration] = useState((item.RunTimeTicks ?? 0) / TICKS_PER_SECOND);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(preferences.volume);
  const [muted, setMuted] = useState(preferences.muted);
  const [speed, setSpeed] = useState(1);
  const [autoplayNext, setAutoplayNext] = useState(
    preferences.autoplayNext && (user.Configuration?.EnableNextEpisodeAutoPlay ?? true),
  );
  const [controlsVisible, setControlsVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [upNextCancelled, setUpNextCancelled] = useState(false);

  // Video takes over from music.
  useEffect(() => useQueue.getState().setPlaying(false), []);

  const listId = params.get("list");
  const nextEpisode = useNextEpisode(item, listId).data ?? null;
  const segments = useSegments(item.Id!).data ?? [];

  // Subtitles added through Finora (decision 0005). Ones Jellyfin hasn't
  // indexed yet are served by the Finora API as extra tracks with negative
  // indices, so they never collide with Jellyfin's stream indices.
  const subtitlesEnabled = useSubtitlesEnabled();
  const finoraSubtitles = useItemSubtitles(item.Id!);
  const finoraReady = !subtitlesEnabled || finoraSubtitles.isFetched;
  const tracks = useMemo<SubtitleTrack[]>(() => {
    if (!source) return [];
    const pending = (finoraSubtitles.data ?? [])
      .filter(
        (subtitle) =>
          !source.subtitleTracks.some((track) => track.index === subtitle.jellyfinStreamIndex),
      )
      .map((subtitle, position) => ({
        index: -100 - position,
        label: `${subtitle.release || subtitle.language.toUpperCase()} (added in Finora)`,
        language: subtitle.language,
        url: `${config.apiUrl}${subtitle.url}`,
        isForced: subtitle.forced,
      }));
    return [...source.subtitleTracks, ...pending];
  }, [source, finoraSubtitles.data, config.apiUrl]);

  // Choose the initial subtitle once the server has resolved the source.
  useEffect(() => {
    if (!source || !finoraReady) return;
    setSubtitleIndex(
      chooseInitialSubtitle({
        source,
        tracks,
        requested: request.subtitleIndex,
        finoraSubtitles: finoraSubtitles.data ?? [],
        preferredLanguage: user.Configuration?.SubtitleLanguagePreference ?? null,
        apiUrl: config.apiUrl,
      }),
    );
    // Only when the source or the Finora list first becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, request.subtitleIndex, finoraReady]);

  const snapshot = useCallback((): PlaybackSnapshot => {
    const video = videoRef.current;
    return {
      positionSeconds: video?.currentTime ?? 0,
      isPaused: video?.paused ?? true,
      isMuted: video?.muted ?? false,
      volume: video?.volume ?? 1,
      audioIndex: request.audioIndex ?? source?.mediaSource.DefaultAudioStreamIndex ?? undefined,
      // Finora-only tracks are not Jellyfin streams.
      subtitleIndex: subtitleIndex < -1 ? -1 : subtitleIndex,
      playbackRate: video?.playbackRate ?? 1,
    };
  }, [request.audioIndex, source, subtitleIndex]);

  // Attach the stream to the <video> element (hls.js where the browser lacks native HLS).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !source) return;
    const startSeconds = request.startTicks / TICKS_PER_SECOND;
    reporterRef.current = createReporter(api, item.Id!, {
      mediaSourceId: source.mediaSource.Id!,
      playSessionId: source.playSessionId,
      method: source.method,
    });
    setMediaError(null);
    setWaiting(true);

    let hls: Hls | null = null;
    const nativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";
    if (source.isHls && !nativeHls && Hls.isSupported()) {
      hls = new Hls({ startPosition: startSeconds, maxBufferLength: 60, backBufferLength: 90 });
      hls.loadSource(source.url);
      hls.attachMedia(video);
      let mediaRecoveries = 0;
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls?.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries++ < 2)
          hls?.recoverMediaError();
        else setMediaError("The stream stopped unexpectedly.");
      });
    } else {
      video.src = source.url;
      const seekToStart = () => {
        if (startSeconds > 0) video.currentTime = startSeconds;
      };
      video.addEventListener("loadedmetadata", seekToStart, { once: true });
    }
    video.playbackRate = speed;
    void video.play().catch(() => setPlaying(false));

    return () => {
      reporterRef.current?.stop(snapshot());
      reporterRef.current = null;
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
    // Re-attach only when the server gives us a new source.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  // Periodic progress reports while playing.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => reporterRef.current?.progress(snapshot()),
      PROGRESS_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [playing, snapshot]);

  // Report when the tab closes.
  useEffect(() => {
    const onUnload = () => reporterRef.current?.stop(snapshot(), true);
    window.addEventListener("pagehide", onUnload);
    return () => window.removeEventListener("pagehide", onUnload);
  }, [snapshot]);

  // Show the selected text subtitle; hide the rest.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !source) return;
    const textTracks = tracks.filter((track) => track.url);
    for (let i = 0; i < video.textTracks.length; i++) {
      const textTrack = video.textTracks[i]!;
      textTrack.mode = textTracks[i]?.index === subtitleIndex ? "showing" : "disabled";
    }
  }, [subtitleIndex, source, tracks]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
  }, [volume, muted]);

  // Restarts the stream (new track, quality or fallback) at the current position.
  const reload = useCallback(
    (changes: Partial<PlaybackRequest>) => {
      const position = videoRef.current?.currentTime ?? request.startTicks / TICKS_PER_SECOND;
      setRequest((previous) => ({
        ...previous,
        // Keep the viewer's current subtitle choice across restarts.
        subtitleIndex,
        ...changes,
        startTicks: Math.round(position * TICKS_PER_SECOND),
      }));
    },
    [request.startTicks, subtitleIndex],
  );

  const onVideoError = () => {
    if (!source) return;
    if (source.method === "DirectPlay" && !request.forceStream) {
      // The browser could not decode the original file after all: let the server convert it.
      reload({ forceStream: true });
      return;
    }
    setMediaError("This browser could not play the stream.");
  };

  const selectSubtitle = (index: number) => {
    if (!source) return;
    const track = tracks.find((candidate) => candidate.index === index);
    const needsBurnIn = track !== undefined && track.url === null;
    if (needsBurnIn || source.burnedSubtitleIndex !== null) {
      reload({ subtitleIndex: index < -1 ? -1 : index });
    }
    setSubtitleIndex(index);
    reporterRef.current?.progress({ ...snapshot(), subtitleIndex: index < -1 ? -1 : index });
  };

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(seconds, video.duration || seconds));
    setCurrent(video.currentTime);
  }, []);

  const seekBy = useCallback(
    (delta: number) => seekTo((videoRef.current?.currentTime ?? 0) + delta),
    [seekTo],
  );

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const changeVolume = useCallback((value: number) => {
    const next = Math.min(1, Math.max(0, value));
    setVolume(next);
    setMuted(next === 0);
    savePlayerPreferences({ volume: next, muted: next === 0 });
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((value) => {
      savePlayerPreferences({ muted: !value });
      return !value;
    });
  }, []);

  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    void navigate(-1);
  }, [navigate]);

  const goToNext = useCallback(() => {
    if (nextEpisode?.Id) {
      const query = listId ? `?list=${encodeURIComponent(listId)}` : "";
      void navigate(`/play/${nextEpisode.Id}${query}`, { replace: true });
    }
  }, [navigate, nextEpisode, listId]);

  // Auto-hiding controls.
  const revealControls = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!videoRef.current?.paused) setControlsVisible(false);
    }, CONTROLS_TIMEOUT_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);
  useEffect(() => {
    if (!playing) setControlsVisible(true);
    else revealControls();
  }, [playing, revealControls]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [role=menu], [role=slider]")) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const actions: Record<string, () => void> = {
        " ": togglePlay,
        k: togglePlay,
        ArrowLeft: () => seekBy(-5),
        ArrowRight: () => seekBy(5),
        j: () => seekBy(-10),
        l: () => seekBy(10),
        ArrowUp: () => changeVolume(volume + 0.1),
        ArrowDown: () => changeVolume(volume - 0.1),
        m: toggleMute,
        f: toggleFullscreen,
        i: () => setShowInfo((value) => !value),
        c: () => {
          const first = tracks[0];
          if (first) selectSubtitle(subtitleIndex === -1 ? first.index : -1);
        },
        Escape: () => {
          if (!document.fullscreenElement) exit();
        },
      };
      const action = actions[event.key];
      if (action) {
        event.preventDefault();
        action();
        revealControls();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // System media controls (keyboard media keys, lock screen, notification).
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const artwork = posterImage(item) ?? landscapeImage(item);
    navigator.mediaSession.metadata = new MediaMetadata({
      title:
        item.Type === "Episode"
          ? `${episodeCode(item) ?? ""} ${item.Name ?? ""}`.trim()
          : (item.Name ?? ""),
      artist: item.Type === "Episode" ? (item.SeriesName ?? "") : String(item.ProductionYear ?? ""),
      artwork: artwork
        ? [{ src: imageUrl(config.jellyfinUrl, artwork, 512), sizes: "512x512" }]
        : [],
    });
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => void videoRef.current?.play()],
      ["pause", () => videoRef.current?.pause()],
      ["seekbackward", () => seekBy(-10)],
      ["seekforward", () => seekBy(10)],
      ["seekto", (details) => details.seekTime !== undefined && seekTo(details.seekTime)],
      ["nexttrack", () => goToNext()],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Unsupported action in this browser.
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // Ignore.
        }
      }
    };
  }, [item, config.jellyfinUrl, seekBy, seekTo, goToNext]);

  const trickplay = useMemo(
    () => trickplayInfo(item, source?.mediaSource.Id ?? undefined),
    [item, source],
  );
  const frameAt = useMemo(
    () =>
      trickplay && source?.mediaSource.Id
        ? (seconds: number) =>
            trickplayFrame(
              trickplay,
              seconds,
              config.jellyfinUrl,
              item.Id!,
              source.mediaSource.Id!,
              api.accessToken,
            )
        : undefined,
    [trickplay, source, config.jellyfinUrl, item.Id, api.accessToken],
  );

  const activeSegment = segments.find(
    (segment) => current >= segment.start && current < segment.end - 1,
  );
  const remaining = duration - current;
  const showUpNext =
    Boolean(nextEpisode) &&
    !upNextCancelled &&
    (ended || (duration > 0 && remaining <= 30 && remaining > 0));

  if (playback.isError || mediaError) {
    return (
      <PlayerError
        message={
          mediaError ??
          (playback.error instanceof Error ? playback.error.message : "Playback failed.")
        }
        onBack={exit}
        onRetry={() => {
          setMediaError(null);
          reload({ forceStream: true });
          void playback.refetch();
        }}
      />
    );
  }

  const title = item.Type === "Episode" ? item.SeriesName : item.Name;
  const subtitle =
    item.Type === "Episode" ? `${episodeCode(item) ?? ""} · ${item.Name ?? ""}` : null;
  const poster = backdropImage(item);

  return (
    <div
      ref={containerRef}
      className={cn("fixed inset-0 z-50 bg-black select-none", !controlsVisible && "cursor-none")}
      onPointerMove={revealControls}
      onPointerDown={revealControls}
    >
      <video
        ref={videoRef}
        crossOrigin="anonymous"
        playsInline
        poster={poster ? imageUrl(config.jellyfinUrl, poster, 1280) : undefined}
        className="size-full object-contain"
        onClick={(event) => {
          if (event.detail === 1 && window.matchMedia("(pointer: fine)").matches) togglePlay();
        }}
        onDoubleClick={toggleFullscreen}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          reporterRef.current?.progress(snapshot());
        }}
        onPlaying={() => {
          setWaiting(false);
          setEnded(false);
          reporterRef.current?.start(snapshot());
        }}
        onWaiting={() => setWaiting(true)}
        onCanPlay={() => setWaiting(false)}
        onSeeked={() => reporterRef.current?.progress(snapshot())}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          setCurrent(video.currentTime);
          if (video.buffered.length) setBuffered(video.buffered.end(video.buffered.length - 1));
        }}
        onDurationChange={(event) => {
          if (Number.isFinite(event.currentTarget.duration))
            setDuration(event.currentTarget.duration);
        }}
        onEnded={() => {
          setEnded(true);
          setPlaying(false);
          reporterRef.current?.stop(snapshot());
          if (!nextEpisode) exit();
        }}
        onError={onVideoError}
      >
        {tracks
          .filter((track) => track.url)
          .map((track) => (
            <track
              key={`${source?.playSessionId}-${track.index}`}
              kind="subtitles"
              src={track.url!}
              label={track.label}
              srcLang={track.language}
            />
          ))}
      </video>

      {(waiting || playback.isPending) && !mediaError && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Spinner label="Buffering" className="[&_svg]:size-12 [&_svg]:text-white" />
        </div>
      )}

      {showInfo && source && (
        <PlaybackInfoPanel source={source} onClose={() => setShowInfo(false)} />
      )}

      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex flex-col justify-between transition-opacity duration-200",
          controlsVisible ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="pointer-events-auto flex items-center gap-3 bg-linear-to-b from-black/80 to-transparent px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10 md:px-6">
          <button type="button" onClick={exit} aria-label="Back" className={CONTROL_BUTTON}>
            <ArrowLeft aria-hidden className="size-6" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-title text-white">{title}</p>
            {subtitle && <p className="truncate text-body-sm text-white/75">{subtitle}</p>}
          </div>
        </div>

        <div className="pointer-events-auto bg-linear-to-t from-black/85 via-black/50 to-transparent px-4 pt-16 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6">
          <SeekBar
            current={current}
            duration={duration}
            buffered={buffered}
            chapters={item.Chapters ?? []}
            onSeek={seekTo}
            frameAt={frameAt}
          />
          <div className="mt-1 flex items-center gap-1">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className={CONTROL_BUTTON}
            >
              {playing ? (
                <Pause aria-hidden className="size-6 fill-current" />
              ) : (
                <Play aria-hidden className="size-6 fill-current" />
              )}
            </button>
            <button
              type="button"
              onClick={() => seekBy(-10)}
              aria-label="Back 10 seconds"
              className={CONTROL_BUTTON}
            >
              <RotateCcw aria-hidden className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => seekBy(30)}
              aria-label="Forward 30 seconds"
              className={CONTROL_BUTTON}
            >
              <RotateCw aria-hidden className="size-5" />
            </button>
            <div className="group/volume flex items-center">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? "Unmute" : "Mute"}
                className={CONTROL_BUTTON}
              >
                {muted || volume === 0 ? (
                  <VolumeX aria-hidden className="size-6" />
                ) : volume < 0.5 ? (
                  <Volume1 aria-hidden className="size-6" />
                ) : (
                  <Volume2 aria-hidden className="size-6" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(event) => changeVolume(Number(event.target.value))}
                aria-label="Volume"
                className="hidden w-0 accent-white opacity-0 transition-all duration-200 group-hover/volume:w-24 group-hover/volume:opacity-100 focus-visible:w-24 focus-visible:opacity-100 [@media(pointer:fine)]:block"
              />
            </div>
            <span className="ml-2 text-body-sm text-white/85 tabular-nums">
              {formatClock(current)} / {formatClock(duration)}
            </span>
            <span className="flex-1" />
            {source && (
              <>
                <SubtitleMenu tracks={tracks} selected={subtitleIndex} onSelect={selectSubtitle} />
                <AudioMenu
                  tracks={source.audioTracks}
                  selected={
                    request.audioIndex ?? source.mediaSource.DefaultAudioStreamIndex ?? undefined
                  }
                  onSelect={(audioIndex) => reload({ audioIndex })}
                />
              </>
            )}
            <SettingsMenu
              bitrate={request.maxBitrate}
              onBitrate={(maxBitrate) => {
                savePlayerPreferences({ maxBitrate });
                reload({ maxBitrate, forceStream: false });
              }}
              speed={speed}
              onSpeed={(value) => {
                setSpeed(value);
                if (videoRef.current) videoRef.current.playbackRate = value;
              }}
              autoplayNext={autoplayNext}
              onAutoplayNext={(value) => {
                setAutoplayNext(value);
                savePlayerPreferences({ autoplayNext: value });
              }}
              showAutoplay={item.Type === "Episode" || item.Type === "Video"}
              onShowInfo={() => setShowInfo(true)}
            />
            {document.pictureInPictureEnabled && (
              <button
                type="button"
                onClick={() => {
                  if (document.pictureInPictureElement) void document.exitPictureInPicture();
                  else void videoRef.current?.requestPictureInPicture();
                }}
                aria-label="Picture in picture"
                className={cn(CONTROL_BUTTON, "hidden sm:grid")}
              >
                <PictureInPicture2 aria-hidden className="size-5" />
              </button>
            )}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? "Exit full screen" : "Full screen"}
              className={CONTROL_BUTTON}
            >
              {fullscreen ? (
                <Minimize aria-hidden className="size-5" />
              ) : (
                <Maximize aria-hidden className="size-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {activeSegment && !showUpNext && (
        <SkipSegmentButton
          segment={activeSegment}
          onSkip={() => seekTo(activeSegment.end)}
          raised={controlsVisible}
        />
      )}

      {showUpNext && nextEpisode && (
        <UpNext
          episode={nextEpisode}
          countdown={ended && autoplayNext}
          onPlay={goToNext}
          onCancel={() => {
            setUpNextCancelled(true);
            if (ended) exit();
          }}
          raised={controlsVisible}
        />
      )}
    </div>
  );
}

const SEGMENT_LABEL: Record<SkippableSegment["type"], string> = {
  Intro: "Skip intro",
  Recap: "Skip recap",
  Outro: "Skip credits",
  Preview: "Skip preview",
  Commercial: "Skip ad",
};

function SkipSegmentButton({
  segment,
  onSkip,
  raised,
}: {
  segment: SkippableSegment;
  onSkip: () => void;
  raised: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSkip}
      className={cn(
        "absolute right-4 rounded-full bg-white px-6 py-3 text-label-md text-black shadow-[0_8px_24px_rgb(0_0_0/0.5)] transition-[bottom] duration-200 hover:bg-white/90 md:right-6",
        raised ? "bottom-36" : "bottom-10",
      )}
    >
      {SEGMENT_LABEL[segment.type]}
    </button>
  );
}

function UpNext({
  episode,
  countdown,
  onPlay,
  onCancel,
  raised,
}: {
  episode: BaseItemDto;
  countdown: boolean;
  onPlay: () => void;
  onCancel: () => void;
  raised: boolean;
}) {
  const { config } = useRuntimeConfig();
  const [secondsLeft, setSecondsLeft] = useState(UP_NEXT_SECONDS);
  const image = landscapeImage(episode);

  useEffect(() => {
    if (!countdown) return;
    if (secondsLeft <= 0) {
      onPlay();
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, secondsLeft, onPlay]);

  return (
    <div
      role="dialog"
      aria-label="Up next"
      className={cn(
        "absolute right-4 w-[min(22rem,calc(100%-2rem))] overflow-hidden rounded-lg bg-surface-overlay/95 shadow-[0_16px_48px_rgb(0_0_0/0.6)] ring-1 ring-border backdrop-blur transition-[bottom] duration-200 md:right-6",
        raised ? "bottom-36" : "bottom-10",
      )}
    >
      {image && (
        <img
          src={imageUrl(config.jellyfinUrl, image, 352)}
          alt=""
          className="aspect-video w-full object-cover"
        />
      )}
      <div className="p-4">
        <p className="text-label-sm text-on-surface-subtle">
          Up next{countdown ? ` in ${secondsLeft}s` : ""}
        </p>
        <p className="mt-1 line-clamp-2 text-label-md">
          {[episodeCode(episode), episode.Name].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={onPlay}>
            Play now
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            {countdown ? "Cancel" : "Dismiss"}
          </Button>
        </div>
      </div>
    </div>
  );
}

const REASON_TEXT: Record<string, string> = {
  ContainerNotSupported: "file container not supported by this browser",
  VideoCodecNotSupported: "video codec not supported by this browser",
  AudioCodecNotSupported: "audio codec not supported by this browser",
  ContainerBitrateExceedsLimit: "file bitrate above the selected quality",
  VideoBitrateNotSupported: "video bitrate above the selected quality",
  AudioBitrateNotSupported: "audio bitrate above the selected quality",
  SubtitleCodecNotSupported: "subtitles have to be burned in",
  VideoBitDepthNotSupported: "10-bit video not supported by this browser",
  VideoProfileNotSupported: "video profile not supported by this browser",
  VideoLevelNotSupported: "video level not supported by this browser",
  AudioChannelsNotSupported: "too many audio channels",
  SecondaryAudioNotSupported: "the selected audio track needs remuxing",
};

function PlaybackInfoPanel({ source, onClose }: { source: PlaybackSource; onClose: () => void }) {
  const streams = source.mediaSource.MediaStreams ?? [];
  const video = streams.find((stream) => stream.Type === "Video");
  const rows: [string, string | null | undefined][] = [
    [
      "Method",
      source.method === "DirectPlay"
        ? "Direct play"
        : source.method === "DirectStream"
          ? "Direct stream (remux)"
          : "Transcode",
    ],
    [
      "Reason",
      source.transcodeReasons.map((reason) => REASON_TEXT[reason] ?? reason).join("; ") || null,
    ],
    ["Container", source.mediaSource.Container],
    [
      "Video",
      video
        ? `${video.Codec?.toUpperCase() ?? ""} ${video.Width ?? ""}×${video.Height ?? ""} ${video.BitDepth ? `${video.BitDepth}-bit` : ""}`
        : null,
    ],
    [
      "Bitrate",
      source.mediaSource.Bitrate
        ? `${(source.mediaSource.Bitrate / 1_000_000).toFixed(1)} Mbps`
        : null,
    ],
    ["Delivery", source.isHls ? "HLS" : "Progressive"],
  ];
  return (
    <div className="absolute top-20 left-4 z-10 w-[min(24rem,calc(100%-2rem))] rounded-lg bg-black/80 p-4 text-body-sm ring-1 ring-white/15 md:left-6">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-label-md">Playback info</p>
        <button
          type="button"
          onClick={onClose}
          className="text-label-sm text-white/70 hover:text-white"
        >
          Close
        </button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-white/60">{label}</dt>
              <dd className="min-w-0 break-words">{value}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}
