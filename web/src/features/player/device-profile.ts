import {
  CodecType,
  DlnaProfileType,
  EncodingContext,
  MediaStreamProtocol,
  ProfileConditionType,
  ProfileConditionValue,
  SubtitleDeliveryMethod,
  type DeviceProfile,
} from "@jellyfin/sdk/lib/generated-client/models";

/**
 * Detects what this browser can decode and describes it to Jellyfin, so the
 * server streams files untouched whenever possible. The reference server has
 * no hardware transcoding, so accuracy here directly saves CPU.
 */

export interface MediaSupport {
  video: {
    h264: boolean;
    hevc: boolean;
    av1: boolean;
    vp9: boolean;
    vp8: boolean;
    h264Hi10: boolean;
  };
  audio: {
    aac: boolean;
    mp3: boolean;
    opus: boolean;
    flac: boolean;
    vorbis: boolean;
    ac3: boolean;
    eac3: boolean;
    alac: boolean;
  };
  containers: { mkv: boolean; webm: boolean };
}

type Probe = (mime: string) => boolean;

/** Real probe: MediaSource.isTypeSupported first, then <video>.canPlayType. */
export function browserProbe(video: HTMLVideoElement = document.createElement("video")): Probe {
  return (mime) => {
    try {
      if (typeof MediaSource !== "undefined" && MediaSource.isTypeSupported(mime)) return true;
    } catch {
      // Some browsers throw for unknown MIME types.
    }
    return video.canPlayType(mime).replace("no", "") !== "";
  };
}

export function detectSupport(probe: Probe): MediaSupport {
  return {
    video: {
      h264: probe('video/mp4; codecs="avc1.640029"'),
      h264Hi10: probe('video/mp4; codecs="avc1.6e0033"'),
      hevc:
        probe('video/mp4; codecs="hvc1.1.6.L120.90"') ||
        probe('video/mp4; codecs="hev1.1.6.L120.90"'),
      av1: probe('video/mp4; codecs="av01.0.08M.08"'),
      vp9: probe('video/webm; codecs="vp9"') || probe('video/mp4; codecs="vp09.00.10.08"'),
      vp8: probe('video/webm; codecs="vp8"'),
    },
    audio: {
      aac: probe('audio/mp4; codecs="mp4a.40.2"'),
      mp3: probe("audio/mpeg"),
      opus: probe('audio/webm; codecs="opus"') || probe('audio/mp4; codecs="opus"'),
      flac: probe("audio/flac") || probe('audio/mp4; codecs="flac"'),
      vorbis: probe('audio/webm; codecs="vorbis"') || probe("audio/ogg; codecs=vorbis"),
      ac3: probe('audio/mp4; codecs="ac-3"'),
      eac3: probe('audio/mp4; codecs="ec-3"'),
      alac: probe('audio/mp4; codecs="alac"'),
    },
    containers: {
      mkv:
        probe("video/x-matroska") ||
        probe("video/mkv") ||
        probe('video/x-matroska; codecs="avc1.640029"'),
      webm: probe("video/webm"),
    },
  };
}

function list(entries: [string, boolean][]): string {
  return entries
    .filter(([, supported]) => supported)
    .map(([codec]) => codec)
    .join(",");
}

export function buildDeviceProfile(support: MediaSupport, maxBitrate: number): DeviceProfile {
  const { video, audio, containers } = support;

  const videoCodecs = list([
    ["h264", video.h264],
    ["hevc", video.hevc],
    ["av1", video.av1],
    ["vp9", video.vp9],
  ]);
  const mp4Audio = list([
    ["aac", audio.aac],
    ["mp3", audio.mp3],
    ["opus", audio.opus],
    ["flac", audio.flac],
    ["ac3", audio.ac3],
    ["eac3", audio.eac3],
    ["alac", audio.alac],
  ]);
  const webmAudio = list([
    ["opus", audio.opus],
    ["vorbis", audio.vorbis],
  ]);
  // Codecs the server may copy into HLS without re-encoding (fMP4 segments).
  const hlsVideo = list([
    ["h264", video.h264],
    ["hevc", video.hevc],
    ["av1", video.av1],
  ]);
  const hlsAudio = list([
    ["aac", audio.aac],
    ["mp3", audio.mp3],
    ["opus", audio.opus],
    ["flac", audio.flac],
    ["ac3", audio.ac3],
    ["eac3", audio.eac3],
  ]);

  const directPlay: DeviceProfile["DirectPlayProfiles"] = [
    {
      Container: "mp4,m4v,mov",
      Type: DlnaProfileType.Video,
      VideoCodec: videoCodecs,
      AudioCodec: mp4Audio,
    },
  ];
  if (containers.webm) {
    directPlay.push({
      Container: "webm",
      Type: DlnaProfileType.Video,
      VideoCodec: list([
        ["vp8", video.vp8],
        ["vp9", video.vp9],
        ["av1", video.av1],
      ]),
      AudioCodec: webmAudio,
    });
  }
  if (containers.mkv) {
    directPlay.push({
      Container: "mkv",
      Type: DlnaProfileType.Video,
      VideoCodec: videoCodecs,
      AudioCodec: mp4Audio,
    });
  }
  directPlay.push(
    { Container: "mp3", Type: DlnaProfileType.Audio },
    {
      Container: "m4a,mp4,m4b",
      AudioCodec: list([
        ["aac", audio.aac],
        ["alac", audio.alac],
        ["flac", audio.flac],
      ]),
      Type: DlnaProfileType.Audio,
    },
    ...(audio.flac ? [{ Container: "flac", Type: DlnaProfileType.Audio }] : []),
    ...(audio.opus || audio.vorbis
      ? [{ Container: "ogg,oga,opus,webm", AudioCodec: webmAudio, Type: DlnaProfileType.Audio }]
      : []),
    { Container: "wav", Type: DlnaProfileType.Audio },
  );

  const h264Conditions = [
    {
      Condition: ProfileConditionType.EqualsAny,
      Property: ProfileConditionValue.VideoProfile,
      Value: video.h264Hi10
        ? "high|main|baseline|constrained baseline|high 10"
        : "high|main|baseline|constrained baseline",
      IsRequired: false,
    },
    {
      Condition: ProfileConditionType.LessThanEqual,
      Property: ProfileConditionValue.VideoLevel,
      Value: "52",
      IsRequired: false,
    },
    ...(video.h264Hi10
      ? []
      : [
          {
            Condition: ProfileConditionType.LessThanEqual,
            Property: ProfileConditionValue.VideoBitDepth,
            Value: "8",
            IsRequired: false,
          },
        ]),
  ];

  return {
    Name: "Finora",
    MaxStreamingBitrate: maxBitrate,
    MaxStaticBitrate: maxBitrate,
    MusicStreamingTranscodingBitrate: 320_000,
    DirectPlayProfiles: directPlay,
    TranscodingProfiles: [
      {
        Container: "mp4",
        Type: DlnaProfileType.Video,
        Protocol: MediaStreamProtocol.Hls,
        Context: EncodingContext.Streaming,
        VideoCodec: hlsVideo || "h264",
        AudioCodec: hlsAudio || "aac",
        MaxAudioChannels: "6",
        MinSegments: 1,
        BreakOnNonKeyFrames: true,
      },
      {
        Container: "mp3",
        Type: DlnaProfileType.Audio,
        AudioCodec: "mp3",
        Context: EncodingContext.Streaming,
        Protocol: MediaStreamProtocol.Http,
        MaxAudioChannels: "2",
      },
    ],
    ContainerProfiles: [],
    CodecProfiles: [
      { Type: CodecType.Video, Codec: "h264", Conditions: h264Conditions },
      {
        Type: CodecType.Video,
        Codec: "hevc",
        Conditions: [
          {
            Condition: ProfileConditionType.EqualsAny,
            Property: ProfileConditionValue.VideoProfile,
            Value: "main|main 10",
            IsRequired: false,
          },
        ],
      },
    ],
    SubtitleProfiles: [
      // Text subtitles (SRT, VTT, ASS…) are delivered as WebVTT side files and rendered by Finora.
      { Format: "vtt", Method: SubtitleDeliveryMethod.External },
      // Image subtitles (PGS, VobSub) can only be burned in.
      { Format: "pgssub", Method: SubtitleDeliveryMethod.Encode },
      { Format: "dvdsub", Method: SubtitleDeliveryMethod.Encode },
      { Format: "dvbsub", Method: SubtitleDeliveryMethod.Encode },
    ],
  };
}
