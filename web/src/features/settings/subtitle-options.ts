import type { CultureDto, SubtitlePlaybackMode } from "@jellyfin/sdk/lib/generated-client/models";

export const SUBTITLE_MODES: { value: SubtitlePlaybackMode; label: string; hint: string }[] = [
  { value: "Default", label: "Default", hint: "Show subtitles marked default or forced" },
  { value: "Smart", label: "Smart", hint: "Show subtitles when the audio is in another language" },
  { value: "OnlyForced", label: "Only forced", hint: "Only subtitles for foreign-language parts" },
  { value: "Always", label: "Always", hint: "Always show subtitles when available" },
  { value: "None", label: "Off", hint: "Never show subtitles automatically" },
];

/**
 * Jellyfin cultures as [three-letter code, name] pairs, sorted by name.
 * Several cultures share a code (e.g. Chinese variants); the first one wins.
 */
export function languageOptions(cultures: CultureDto[] | undefined): [string, string][] {
  return [
    ...new Map(
      (cultures ?? [])
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
