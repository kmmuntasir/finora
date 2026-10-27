import type { FinoraSubtitle } from "@/features/subtitles/api";
import type { PlaybackSource, SubtitleTrack } from "./playback";

interface Choice {
  source: PlaybackSource;
  /** Jellyfin tracks plus Finora-only tracks (negative indices). */
  tracks: SubtitleTrack[];
  /** Explicit choice from the detail page, if any. */
  requested: number | undefined;
  /** Finora-added subtitles, newest first. */
  finoraSubtitles: FinoraSubtitle[];
  /** The viewer's Jellyfin subtitle language (three-letter), if set. */
  preferredLanguage: string | null;
  apiUrl: string | null;
}

/**
 * The subtitle shown when playback starts (decision 0005):
 * 1. a subtitle burned into the stream;
 * 2. without an explicit choice, the newest Finora-added subtitle in the
 *    viewer's language (Jellyfin's copy if indexed, otherwise Finora's);
 * 3. the explicit choice, or Jellyfin's default; otherwise off (-1).
 */
export function chooseInitialSubtitle({
  source,
  tracks,
  requested,
  finoraSubtitles,
  preferredLanguage,
  apiUrl,
}: Choice): number {
  if (source.burnedSubtitleIndex !== null) return source.burnedSubtitleIndex;
  if (requested === undefined) {
    const added = finoraSubtitles.find(
      (subtitle) =>
        !preferredLanguage ||
        subtitle.language3 === preferredLanguage ||
        subtitle.language === preferredLanguage,
    );
    if (added) {
      const indexed = source.subtitleTracks.find(
        (track) => track.index === added.jellyfinStreamIndex && track.url,
      );
      const pending = tracks.find((track) => apiUrl && track.url === `${apiUrl}${added.url}`);
      const choice = indexed ?? pending;
      if (choice) return choice.index;
    }
  }
  const wanted = requested ?? source.mediaSource.DefaultSubtitleStreamIndex ?? -1;
  return tracks.some((track) => track.index === wanted) ? wanted : -1;
}
