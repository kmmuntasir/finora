import { describe, expect, it } from "vitest";
import type { FinoraSubtitle } from "@/features/subtitles/api";
import type { PlaybackSource, SubtitleTrack } from "./playback";
import { chooseInitialSubtitle } from "./subtitle-choice";

const jellyfinTracks: SubtitleTrack[] = [
  { index: 2, label: "English", language: "eng", url: "http://j/2.vtt", isForced: false },
  { index: 3, label: "French", language: "fre", url: "http://j/3.vtt", isForced: false },
];

const source = {
  burnedSubtitleIndex: null,
  subtitleTracks: jellyfinTracks,
  mediaSource: { DefaultSubtitleStreamIndex: 3 },
} as unknown as PlaybackSource;

function finora(overrides: Partial<FinoraSubtitle>): FinoraSubtitle {
  return {
    id: "f1",
    itemId: "i",
    language: "en",
    language3: "eng",
    provider: "subdl",
    release: "R",
    hearingImpaired: false,
    forced: false,
    createdById: "u",
    createdByName: "U",
    createdAt: "",
    url: "/api/v1/subtitles/files/f1.vtt",
    jellyfinStreamIndex: null,
    ...overrides,
  };
}

const pendingTrack: SubtitleTrack = {
  index: -100,
  label: "R (added in Finora)",
  language: "en",
  url: "http://api/api/v1/subtitles/files/f1.vtt",
  isForced: false,
};

describe("chooseInitialSubtitle", () => {
  it("prefers a Finora-added subtitle Jellyfin has indexed", () => {
    const choice = chooseInitialSubtitle({
      source,
      tracks: jellyfinTracks,
      requested: undefined,
      finoraSubtitles: [finora({ jellyfinStreamIndex: 2 })],
      preferredLanguage: "eng",
      apiUrl: "http://api",
    });
    expect(choice).toBe(2);
  });

  it("uses the Finora copy until Jellyfin indexes it", () => {
    const choice = chooseInitialSubtitle({
      source,
      tracks: [...jellyfinTracks, pendingTrack],
      requested: undefined,
      finoraSubtitles: [finora({})],
      preferredLanguage: null,
      apiUrl: "http://api",
    });
    expect(choice).toBe(-100);
  });

  it("respects an explicit choice and the viewer's language", () => {
    const base = {
      source,
      tracks: jellyfinTracks,
      finoraSubtitles: [finora({ jellyfinStreamIndex: 2 })],
      apiUrl: "http://api",
    };
    expect(chooseInitialSubtitle({ ...base, requested: -1, preferredLanguage: "eng" })).toBe(-1);
    // A Bengali speaker isn't switched to an English Finora subtitle; Jellyfin's default applies.
    expect(chooseInitialSubtitle({ ...base, requested: undefined, preferredLanguage: "ben" })).toBe(
      3,
    );
  });

  it("keeps burned-in subtitles", () => {
    const burned = { ...source, burnedSubtitleIndex: 7 } as PlaybackSource;
    expect(
      chooseInitialSubtitle({
        source: burned,
        tracks: [],
        requested: undefined,
        finoraSubtitles: [],
        preferredLanguage: null,
        apiUrl: null,
      }),
    ).toBe(7);
  });
});
