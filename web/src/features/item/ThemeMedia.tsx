import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { getLibraryApi } from "@jellyfin/sdk/lib/utils/api/library-api";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useRuntimeConfig } from "@/config/context";
import { useSession } from "@/features/auth/context";
import { useQueue } from "@/features/music/queue-store";
import { usePreferences } from "@/features/preferences/preferences";

const THEME_TYPES = new Set([
  "Movie",
  "Series",
  "Season",
  "Episode",
  "BoxSet",
  "MusicAlbum",
  "MusicArtist",
]);

/** Theme songs and videos for an item (inherited from the series for seasons and episodes). */
function useThemeMedia(item: BaseItemDto, enabled: boolean) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["theme-media", user.Id, item.Id],
    queryFn: async ({ signal }) =>
      (
        await getLibraryApi(api).getThemeMedia(
          { itemId: item.Id!, userId: user.Id, inheritFromParent: true },
          { signal },
        )
      ).data,
    enabled: enabled && THEME_TYPES.has(item.Type ?? ""),
    staleTime: 10 * 60 * 1000,
  });
}

function streamUrl(baseUrl: string, item: BaseItemDto, token: string): string {
  const kind = item.MediaType === "Audio" ? "Audio" : "Videos";
  return `${baseUrl}/${kind}/${item.Id}/stream?static=true&mediaSourceId=${item.Id}&ApiKey=${encodeURIComponent(token)}`;
}

/**
 * Plays the item's theme song quietly while its page is open (Settings →
 * Playback). Stays silent when music is already playing.
 */
export function ThemeMusic({ item }: { item: BaseItemDto }) {
  const { preferences } = usePreferences();
  const { api } = useSession();
  const { config } = useRuntimeConfig();
  const musicPlaying = useQueue((state) => state.playing);
  const enabled = preferences.themeMedia !== "off";
  const theme = useThemeMedia(item, enabled).data?.ThemeSongsResult?.Items?.[0];
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const element = audio.current;
    if (!element || !theme || musicPlaying) return;
    element.volume = 0;
    // Browsers may refuse autoplay before the first interaction; then it simply stays quiet.
    void element.play().catch(() => undefined);
    let volume = 0;
    const fade = window.setInterval(() => {
      volume = Math.min(0.3, volume + 0.03);
      element.volume = volume;
      if (volume >= 0.3) window.clearInterval(fade);
    }, 150);
    return () => {
      window.clearInterval(fade);
      element.pause();
    };
  }, [theme, musicPlaying]);

  if (!enabled || !theme || musicPlaying) return null;
  return (
    <audio ref={audio} src={streamUrl(config.jellyfinUrl, theme, api.accessToken)} preload="auto" />
  );
}

/** A muted, looping theme video behind the detail header, when there is one and it's enabled. */
export function ThemeVideo({ item, className }: { item: BaseItemDto; className: string }) {
  const { preferences } = usePreferences();
  const { api } = useSession();
  const { config } = useRuntimeConfig();
  const enabled = preferences.themeMedia === "all";
  const theme = useThemeMedia(item, enabled).data?.ThemeVideosResult?.Items?.[0];
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!enabled || !theme || failed) return null;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  return (
    <video
      src={streamUrl(config.jellyfinUrl, theme, api.accessToken)}
      autoPlay
      muted
      loop
      playsInline
      aria-hidden
      onCanPlay={() => setReady(true)}
      onError={() => setFailed(true)}
      className={`${className} transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
    />
  );
}
