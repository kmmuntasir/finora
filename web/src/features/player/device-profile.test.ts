import { describe, expect, it } from "vitest";
import { buildDeviceProfile, detectSupport } from "./device-profile";

const chromeLike = (mime: string) =>
  /avc1\.64|mp4a|audio\/mpeg|opus|flac|vp9|vp8|vorbis|av01|video\/webm/.test(mime) &&
  !/hvc1|hev1|ac-3|ec-3|6e00/.test(mime);

describe("device profile", () => {
  it("lists only codecs the browser supports", () => {
    const support = detectSupport(chromeLike);
    expect(support.video).toMatchObject({
      h264: true,
      hevc: false,
      av1: true,
      vp9: true,
      h264Hi10: false,
    });
    expect(support.audio).toMatchObject({ aac: true, ac3: false, eac3: false, opus: true });

    const profile = buildDeviceProfile(support, 120_000_000);
    const mp4 = profile.DirectPlayProfiles?.find((p) => p.Container === "mp4,m4v,mov");
    expect(mp4?.VideoCodec).toBe("h264,av1,vp9");
    expect(mp4?.AudioCodec).not.toContain("ac3");
    expect(profile.TranscodingProfiles?.[0]).toMatchObject({
      Protocol: "hls",
      Container: "mp4",
      VideoCodec: "h264,av1",
    });
    expect(profile.MaxStreamingBitrate).toBe(120_000_000);
  });

  it("refuses 10-bit H.264 when the browser cannot decode it", () => {
    const profile = buildDeviceProfile(detectSupport(chromeLike), 1);
    const h264 = profile.CodecProfiles?.find((p) => p.Codec === "h264");
    expect(h264?.Conditions?.some((c) => c.Property === "VideoBitDepth" && c.Value === "8")).toBe(
      true,
    );
  });

  it("delivers text subtitles as WebVTT", () => {
    const profile = buildDeviceProfile(detectSupport(chromeLike), 1);
    expect(profile.SubtitleProfiles?.[0]).toEqual({ Format: "vtt", Method: "External" });
  });
});

describe("subtitle profiles", () => {
  it("asks for ASS/SSA files only when JASSUB can draw them", () => {
    const formats = (styledSubtitles: boolean) =>
      buildDeviceProfile({ ...detectSupport(chromeLike), styledSubtitles }, 1)
        .SubtitleProfiles?.filter((profile) => profile.Method === "External")
        .map((profile) => profile.Format);
    expect(formats(true)).toEqual(["ass", "ssa", "vtt"]);
    expect(formats(false)).toEqual(["vtt"]);
  });
});
