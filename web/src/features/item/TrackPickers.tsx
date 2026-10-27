import type { BaseItemDto, MediaStream } from "@jellyfin/sdk/lib/generated-client/models";
import { useId } from "react";
import { selectedSource, type PlaySelection } from "./selection";

function Picker({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-label-sm text-on-surface-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full max-w-72 truncate rounded-md border border-border-strong bg-surface px-3 text-body-sm text-on-surface hover:border-on-surface-subtle"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function streamLabel(stream: MediaStream): string {
  return stream.DisplayTitle ?? stream.Language ?? `Track ${stream.Index}`;
}

/** Version, audio and subtitle choices before playback. Hidden when there is nothing to choose. */
export function TrackPickers({
  item,
  selection,
  onChange,
}: {
  item: BaseItemDto;
  selection: PlaySelection;
  onChange: (selection: PlaySelection) => void;
}) {
  const sources = item.MediaSources ?? [];
  const source = selectedSource(item, selection);
  if (!source) return null;
  const streams = source.MediaStreams ?? [];
  const audio = streams.filter((stream) => stream.Type === "Audio");
  const subtitles = streams.filter((stream) => stream.Type === "Subtitle");
  const audioIndex = selection.audioIndex ?? source.DefaultAudioStreamIndex ?? audio[0]?.Index;
  const subtitleIndex = selection.subtitleIndex ?? source.DefaultSubtitleStreamIndex ?? -1;

  if (sources.length < 2 && audio.length < 2 && subtitles.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-4">
      {sources.length > 1 && (
        <Picker
          label="Version"
          value={source.Id ?? ""}
          onChange={(sourceId) => onChange({ sourceId })}
          options={sources.map((option) => ({
            value: option.Id ?? "",
            label: option.Name ?? "Version",
          }))}
        />
      )}
      {audio.length > 1 && (
        <Picker
          label="Audio"
          value={String(audioIndex)}
          onChange={(value) => onChange({ ...selection, audioIndex: Number(value) })}
          options={audio.map((stream) => ({
            value: String(stream.Index),
            label: streamLabel(stream),
          }))}
        />
      )}
      {subtitles.length > 0 && (
        <Picker
          label="Subtitles"
          value={String(subtitleIndex)}
          onChange={(value) => onChange({ ...selection, subtitleIndex: Number(value) })}
          options={[
            { value: "-1", label: "Off" },
            ...subtitles.map((stream) => ({
              value: String(stream.Index),
              label: streamLabel(stream),
            })),
          ]}
        />
      )}
    </div>
  );
}
