import type {
  AccessSchedule,
  DynamicDayOfWeek,
  UnratedItem,
} from "@jellyfin/sdk/lib/generated-client/models";
import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/Button";
import { useParentalRatingLevels } from "./queries";
import type { RestrictionDraft } from "./restrictions";
import { msg, t } from "@/i18n";

const UNRATED: { value: UnratedItem; label: string }[] = [
  { value: "Movie", label: msg("Movies") },
  { value: "Series", label: msg("TV shows") },
  { value: "Music", label: msg("Music") },
  { value: "Book", label: msg("Books") },
  { value: "Trailer", label: msg("Trailers") },
  { value: "LiveTvChannel", label: msg("Live TV channels") },
  { value: "LiveTvProgram", label: msg("Live TV programmes") },
  { value: "ChannelContent", label: msg("Channel content") },
  { value: "Other", label: msg("Other") },
];

const DAYS: { value: DynamicDayOfWeek; label: string }[] = [
  { value: "Everyday", label: msg("Every day") },
  { value: "Weekday", label: msg("Weekdays") },
  { value: "Weekend", label: msg("Weekends") },
  { value: "Monday", label: msg("Monday") },
  { value: "Tuesday", label: msg("Tuesday") },
  { value: "Wednesday", label: msg("Wednesday") },
  { value: "Thursday", label: msg("Thursday") },
  { value: "Friday", label: msg("Friday") },
  { value: "Saturday", label: msg("Saturday") },
  { value: "Sunday", label: msg("Sunday") },
];

/** Bitrate presets in bits per second; 0 is "no limit". */
const BITRATES = [0, 120e6, 80e6, 40e6, 20e6, 15e6, 10e6, 8e6, 6e6, 4e6, 3e6, 1.5e6, 720e3, 420e3];

const SELECT = "h-11 w-full rounded-md border border-border-strong bg-background px-3 text-body-md";

function hourLabel(hour: number): string {
  const whole = Math.floor(hour);
  const minutes = Math.round((hour - whole) * 60);
  return `${String(whole % 24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function bitrateLabel(bps: number): string {
  if (!bps) return t("No limit");
  return bps >= 1e6 ? `${bps / 1e6} Mbps` : `${bps / 1e3} kbps`;
}

interface Props {
  draft: RestrictionDraft;
  set: <K extends keyof RestrictionDraft>(key: K, value: RestrictionDraft[K]) => void;
}

export function ParentalControls({ draft, set }: Props) {
  const levels = useParentalRatingLevels();
  const ratingId = useId();
  const current =
    draft.MaxParentalRating === null || draft.MaxParentalRating === undefined
      ? ""
      : `${draft.MaxParentalRating}:${draft.MaxParentalSubRating ?? ""}`;

  return (
    <div className="space-y-6">
      <div className="sm:max-w-sm">
        <label htmlFor={ratingId} className="mb-1.5 block text-label-md">
          {t("Highest allowed age rating")}
        </label>
        <select
          id={ratingId}
          className={SELECT}
          value={current}
          onChange={(event) => {
            const [score, sub] = event.target.value.split(":");
            set("MaxParentalRating", score ? Number(score) : null);
            set("MaxParentalSubRating", sub ? Number(sub) : null);
          }}
        >
          <option value="">{t("No limit")}</option>
          {levels.data?.map((level) => (
            <option
              key={`${level.score}:${level.subScore ?? ""}`}
              value={`${level.score}:${level.subScore ?? ""}`}
            >
              {level.names.slice(0, 4).join(", ")}
              {level.names.length > 4 ? "…" : ""}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-body-sm text-on-surface-muted">
          {t("Items rated higher are hidden from this user.")}
        </p>
      </div>

      <fieldset>
        <legend className="text-label-md">{t("Hide items with no rating")}</legend>
        <div className="mt-2 grid gap-1 sm:grid-cols-3">
          {UNRATED.map((option) => {
            const checked = draft.BlockUnratedItems?.includes(option.value) ?? false;
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-raised"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) =>
                    set(
                      "BlockUnratedItems",
                      event.target.checked
                        ? [...(draft.BlockUnratedItems ?? []), option.value]
                        : (draft.BlockUnratedItems ?? []).filter((value) => value !== option.value),
                    )
                  }
                  className="size-4 accent-primary"
                />
                <span className="text-body-md">{t(option.label)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <TagList
        label={t("Allow only items with these tags")}
        hint={t("When set, items without one of these tags are hidden.")}
        tags={draft.AllowedTags ?? []}
        onChange={(tags) => set("AllowedTags", tags)}
      />
      <TagList
        label={t("Block items with these tags")}
        tags={draft.BlockedTags ?? []}
        onChange={(tags) => set("BlockedTags", tags)}
      />

      <Schedules
        schedules={draft.AccessSchedules ?? []}
        onChange={(schedules) => set("AccessSchedules", schedules)}
      />
    </div>
  );
}

function TagList({
  label,
  hint,
  tags,
  onChange,
}: {
  label: string;
  hint?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [value, setValue] = useState("");
  const id = useId();
  const add = () => {
    const tag = value.trim();
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setValue("");
  };
  return (
    <div>
      <label htmlFor={id} className="block text-label-md">
        {label}
      </label>
      {hint && <p className="text-body-sm text-on-surface-muted">{hint}</p>}
      {tags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li
              key={tag}
              className="flex items-center gap-1 rounded-full bg-surface-raised py-1 pr-1 pl-3 text-label-sm"
            >
              {tag}
              <button
                type="button"
                aria-label={t("Remove tag {tag}", { tag })}
                onClick={() => onChange(tags.filter((other) => other !== tag))}
                className="grid size-6 place-items-center rounded-full hover:bg-surface-overlay"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-2 sm:max-w-sm">
        <input
          id={id}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder={t("Tag name")}
          className="h-10 min-w-0 flex-1 rounded-md border border-border-strong bg-background px-3 text-body-sm"
        />
        <Button type="button" size="sm" variant="secondary" onClick={add} disabled={!value.trim()}>
          {t("Add")}
        </Button>
      </div>
    </div>
  );
}

function Schedules({
  schedules,
  onChange,
}: {
  schedules: AccessSchedule[];
  onChange: (schedules: AccessSchedule[]) => void;
}) {
  const hours = Array.from({ length: 48 }, (_, index) => index / 2);
  const update = (index: number, changes: Partial<AccessSchedule>) =>
    onChange(
      schedules.map((schedule, i) => (i === index ? { ...schedule, ...changes } : schedule)),
    );
  return (
    <div>
      <p className="text-label-md">{t("Allowed viewing times")}</p>
      <p className="text-body-sm text-on-surface-muted">
        {schedules.length
          ? t("The user can only sign in and watch during these times (server time).")
          : t("No schedule: the user can watch at any time.")}
      </p>
      <ul className="mt-2 space-y-2">
        {schedules.map((schedule, index) => (
          <li key={index} className="flex flex-wrap items-center gap-2">
            <select
              aria-label={t("Days")}
              className="h-10 rounded-md border border-border-strong bg-background px-2 text-body-sm"
              value={schedule.DayOfWeek ?? "Everyday"}
              onChange={(event) =>
                update(index, { DayOfWeek: event.target.value as DynamicDayOfWeek })
              }
            >
              {DAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {t(day.label)}
                </option>
              ))}
            </select>
            <span className="text-body-sm text-on-surface-muted">{t("from")}</span>
            <select
              aria-label={t("Start time")}
              className="h-10 rounded-md border border-border-strong bg-background px-2 text-body-sm"
              value={schedule.StartHour ?? 0}
              onChange={(event) => update(index, { StartHour: Number(event.target.value) })}
            >
              {hours.map((hour) => (
                <option key={hour} value={hour}>
                  {hourLabel(hour)}
                </option>
              ))}
            </select>
            <span className="text-body-sm text-on-surface-muted">{t("to")}</span>
            <select
              aria-label={t("End time")}
              className="h-10 rounded-md border border-border-strong bg-background px-2 text-body-sm"
              value={schedule.EndHour ?? 24}
              onChange={(event) => update(index, { EndHour: Number(event.target.value) })}
            >
              {[...hours.slice(1), 24].map((hour) => (
                <option key={hour} value={hour}>
                  {hour === 24 ? "24:00" : hourLabel(hour)}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label={t("Remove time slot")}
              onClick={() => onChange(schedules.filter((_, i) => i !== index))}
              className="grid size-9 place-items-center rounded-full text-on-surface-muted hover:bg-surface-raised hover:text-error"
            >
              <X aria-hidden className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="mt-2"
        onClick={() =>
          onChange([...schedules, { DayOfWeek: "Everyday", StartHour: 8, EndHour: 20 }])
        }
      >
        <Plus aria-hidden className="size-4" />
        {t("Add time slot")}
      </Button>
    </div>
  );
}

export function Limits({ draft, set }: Props) {
  const sessionsId = useId();
  const bitrateId = useId();
  const bitrate = draft.RemoteClientBitrateLimit ?? 0;
  const options = BITRATES.includes(bitrate) ? BITRATES : [...BITRATES, bitrate];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor={sessionsId} className="mb-1.5 block text-label-md">
          {t("Simultaneous streams")}
        </label>
        <select
          id={sessionsId}
          className={SELECT}
          value={draft.MaxActiveSessions ?? 0}
          onChange={(event) => set("MaxActiveSessions", Number(event.target.value))}
        >
          <option value={0}>{t("No limit")}</option>
          {[1, 2, 3, 4, 5, 6, 8, 10].map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-body-sm text-on-surface-muted">
          {t("Devices signed in at the same time.")}
        </p>
      </div>
      <div>
        <label htmlFor={bitrateId} className="mb-1.5 block text-label-md">
          {t("Internet streaming quality limit")}
        </label>
        <select
          id={bitrateId}
          className={SELECT}
          value={bitrate}
          onChange={(event) => set("RemoteClientBitrateLimit", Number(event.target.value))}
        >
          {options.map((value) => (
            <option key={value} value={value}>
              {bitrateLabel(value)}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-body-sm text-on-surface-muted">
          {t("Applies outside the home network; higher-bitrate files are transcoded.")}
        </p>
      </div>
    </div>
  );
}
