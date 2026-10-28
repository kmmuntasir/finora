import { msg } from "@/i18n";
import type { CultureDto, SubtitlePlaybackMode } from "@jellyfin/sdk/lib/generated-client/models";

export const SUBTITLE_MODES: { value: SubtitlePlaybackMode; label: string; hint: string }[] = [
  { value: "Default", label: msg("Default"), hint: msg("Show subtitles marked default or forced") },
  {
    value: "Smart",
    label: msg("Smart"),
    hint: msg("Show subtitles when the audio is in another language"),
  },
  {
    value: "OnlyForced",
    label: msg("Only forced"),
    hint: msg("Only subtitles for foreign-language parts"),
  },
  { value: "Always", label: msg("Always"), hint: msg("Always show subtitles when available") },
  { value: "None", label: msg("Off"), hint: msg("Never show subtitles automatically") },
];

/**
 * Jellyfin cultures as [three-letter code, name] pairs, sorted by name.
 * Several cultures share a code (e.g. Chinese variants); the first one wins.
 */
export function languageOptions(cultures: CultureDto[] | undefined): [string, string][] {
  return [
    ...new Map(
      (Array.isArray(cultures) ? cultures : [])
        .filter((culture) => culture.ThreeLetterISOLanguageName)
        .map(
          (culture) =>
            [
              culture.ThreeLetterISOLanguageName!,
              culture.DisplayName ?? culture.Name ?? "",
            ] as const,
        )
        .reverse(),
    ),
  ].sort((a, b) => a[1].localeCompare(b[1]));
}
