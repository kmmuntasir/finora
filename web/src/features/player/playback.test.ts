import { describe, expect, it, vi } from "vitest";
import { resolveSource } from "./playback";

vi.mock("@/api/device", () => ({ getDeviceId: () => "device-1" }));

const request = { itemId: "item1", userId: "u", startTicks: 0, maxBitrate: 1 };

describe("resolveSource", () => {
  it("direct plays a compatible file with a static stream URL", () => {
    const source = resolveSource(
      {
        PlaySessionId: "ps",
        MediaSources: [
          {
            Id: "ms1",
            Container: "mkv",
            SupportsDirectPlay: true,
            MediaStreams: [
              { Type: "Audio", Index: 1, DisplayTitle: "English AAC" },
              {
                Type: "Subtitle",
                Index: 2,
                DisplayTitle: "English",
                DeliveryMethod: "External",
                DeliveryUrl: "/Videos/item1/ms1/Subtitles/2/0/Stream.vtt",
                IsTextSubtitleStream: true,
              },
              {
                Type: "Subtitle",
                Index: 3,
                DisplayTitle: "PGS",
                DeliveryMethod: "Encode",
                IsTextSubtitleStream: false,
              },
            ],
          },
        ],
      },
      request,
      "http://h",
      "tok",
    );
    expect(source.method).toBe("DirectPlay");
    expect(source.url).toBe(
      "http://h/Videos/item1/stream.mkv?Static=true&mediaSourceId=ms1&deviceId=device-1&PlaySessionId=ps&ApiKey=tok",
    );
    expect(source.subtitleTracks.map((track) => track.url)).toEqual([
      "http://h/Videos/item1/ms1/Subtitles/2/0/Stream.vtt",
      null,
    ]);
    expect(source.audioTracks[0]).toEqual({ index: 1, label: "English AAC", language: undefined });
  });

  it("treats container-only changes as direct stream", () => {
    const source = resolveSource(
      {
        PlaySessionId: "ps",
        MediaSources: [
          {
            Id: "ms1",
            SupportsDirectPlay: false,
            TranscodingSubProtocol: "hls",
            TranscodingUrl: "/videos/item1/master.m3u8?TranscodeReasons=ContainerNotSupported",
          },
        ],
      },
      request,
      "http://h",
      "tok",
    );
    expect(source).toMatchObject({
      method: "DirectStream",
      isHls: true,
      url: "http://h/videos/item1/master.m3u8?TranscodeReasons=ContainerNotSupported",
    });
  });

  it("reports real transcodes with their reasons", () => {
    const source = resolveSource(
      {
        MediaSources: [
          {
            Id: "ms1",
            TranscodingUrl:
              "/videos/item1/master.m3u8?TranscodeReasons=VideoCodecNotSupported,AudioCodecNotSupported",
          },
        ],
      },
      request,
      "http://h",
      "tok",
    );
    expect(source.method).toBe("Transcode");
    expect(source.transcodeReasons).toEqual(["VideoCodecNotSupported", "AudioCodecNotSupported"]);
  });
});

describe("bitrate caps", () => {
  it("counts a bitrate cap as a transcode", () => {
    const source = resolveSource(
      {
        MediaSources: [
          {
            Id: "ms1",
            TranscodingUrl: "/videos/i/master.m3u8?TranscodeReasons=ContainerBitrateExceedsLimit",
          },
        ],
      },
      request,
      "http://h",
      "tok",
    );
    expect(source.method).toBe("Transcode");
  });
});
