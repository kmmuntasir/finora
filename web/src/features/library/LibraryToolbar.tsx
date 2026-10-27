import {
  ArrowDownUp,
  Check,
  CheckSquare,
  ChevronDown,
  LayoutGrid,
  List,
  RectangleHorizontal,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { MENU_CONTENT, MENU_ITEM } from "@/components/menu";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  FEATURES,
  FILTERS,
  RESOLUTIONS,
  SORTS,
  VIEW_MODES,
  type Feature,
  type LibraryKind,
  type Resolution,
  type SeriesStatus,
  type SortKey,
  type ViewMode,
} from "./library-config";
import type { LibraryState } from "./library-state";

interface LibraryToolbarProps {
  kind: LibraryKind;
  state: LibraryState;
  update: (changes: Partial<LibraryState>) => void;
  genres: string[];
  years: number[];
  ratings: string[];
  tags: string[];
  studios: { id: string; name: string }[];
  selecting: boolean;
  onToggleSelecting: () => void;
}

const VIEW_ICONS: Record<ViewMode, typeof List> = {
  grid: LayoutGrid,
  thumbs: RectangleHorizontal,
  list: List,
};

/** A dropdown with an "Any" choice for one optional filter value. */
function ChoiceMenu({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
}) {
  if (!options.length) return null;
  const current = options.find((option) => option.value === value);
  return (
    <DropdownMenu.Root>
      <MenuButton active={Boolean(current)}>{current?.label ?? label}</MenuButton>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={6} className={MENU_CONTENT}>
          <DropdownMenu.RadioGroup
            value={value ?? ""}
            onValueChange={(next) => onChange(next || null)}
          >
            <DropdownMenu.RadioItem value="" className={MENU_ITEM}>
              <Indicator />
              Any {label.toLowerCase()}
            </DropdownMenu.RadioItem>
            {options.map((option) => (
              <DropdownMenu.RadioItem key={option.value} value={option.value} className={MENU_ITEM}>
                <Indicator />
                {option.label}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuButton({ children, active }: { children: ReactNode; active?: boolean }) {
  return (
    <DropdownMenu.Trigger
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-label-md transition-colors duration-[120ms]",
        active
          ? "bg-primary text-on-primary hover:bg-primary-hover"
          : "bg-surface-raised text-on-surface hover:bg-surface-overlay",
      )}
    >
      {children}
      <ChevronDown aria-hidden className="size-4 opacity-70" />
    </DropdownMenu.Trigger>
  );
}

function Indicator() {
  return (
    <span className="grid size-4 place-items-center">
      <DropdownMenu.ItemIndicator>
        <Check aria-hidden className="size-4 text-primary" />
      </DropdownMenu.ItemIndicator>
    </span>
  );
}

export function LibraryToolbar({
  kind,
  state,
  update,
  genres,
  years,
  ratings,
  tags,
  studios,
  selecting,
  onToggleSelecting,
}: LibraryToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="radiogroup"
        aria-label="View"
        className="flex rounded-full bg-surface-raised p-0.5"
      >
        {(Object.keys(VIEW_MODES) as ViewMode[]).map((mode) => {
          const Icon = VIEW_ICONS[mode];
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={state.view === mode}
              aria-label={VIEW_MODES[mode]}
              title={VIEW_MODES[mode]}
              onClick={() => update({ view: mode })}
              className={cn(
                "grid h-8 w-9 place-items-center rounded-full transition-colors duration-[120ms]",
                state.view === mode
                  ? "bg-surface-overlay text-on-surface"
                  : "text-on-surface-muted hover:text-on-surface",
              )}
            >
              <Icon aria-hidden className="size-4" />
            </button>
          );
        })}
      </div>

      <DropdownMenu.Root>
        <MenuButton>
          <ArrowDownUp aria-hidden className="size-4" />
          {SORTS[state.sort].label}
        </MenuButton>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="start" sideOffset={6} className={MENU_CONTENT}>
            <DropdownMenu.RadioGroup
              value={state.sort}
              onValueChange={(sort) => update({ sort: sort as SortKey })}
            >
              {kind.sorts.map((sort) => (
                <DropdownMenu.RadioItem key={sort} value={sort} className={MENU_ITEM}>
                  <Indicator />
                  {SORTS[sort].label}
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
            {state.sort !== "random" && (
              <>
                <DropdownMenu.Separator className="my-1.5 h-px bg-border" />
                <DropdownMenu.CheckboxItem
                  checked={state.reversed}
                  onCheckedChange={(reversed) => update({ reversed })}
                  className={MENU_ITEM}
                >
                  <Indicator />
                  Reverse order
                </DropdownMenu.CheckboxItem>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {kind.genres && genres.length > 0 && (
        <DropdownMenu.Root>
          <MenuButton active={Boolean(state.genre)}>{state.genre ?? "Genre"}</MenuButton>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="start" sideOffset={6} className={MENU_CONTENT}>
              <DropdownMenu.RadioGroup
                value={state.genre ?? ""}
                onValueChange={(genre) => update({ genre: genre || null })}
              >
                <DropdownMenu.RadioItem value="" className={MENU_ITEM}>
                  <Indicator />
                  All genres
                </DropdownMenu.RadioItem>
                {genres.map((genre) => (
                  <DropdownMenu.RadioItem key={genre} value={genre} className={MENU_ITEM}>
                    <Indicator />
                    {genre}
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}

      {kind.advancedFilters && (
        <>
          <ChoiceMenu
            label="Year"
            value={state.year ? String(state.year) : null}
            options={years.map((year) => ({ value: String(year), label: String(year) }))}
            onChange={(value) => update({ year: value ? Number(value) : null })}
          />
          <ChoiceMenu
            label="Rating"
            value={state.rating}
            options={ratings.map((rating) => ({ value: rating, label: rating }))}
            onChange={(rating) => update({ rating })}
          />
          <ChoiceMenu
            label="Resolution"
            value={state.resolution}
            options={(Object.keys(RESOLUTIONS) as Resolution[]).map((key) => ({
              value: key,
              label: RESOLUTIONS[key],
            }))}
            // Jellyfin can't combine resolution with "has subtitles"; the newest choice wins.
            onChange={(resolution) =>
              update({ resolution: resolution as Resolution | null, subtitles: false })
            }
          />
          <ChoiceMenu
            label="Studio"
            value={state.studio}
            options={studios.map((studio) => ({ value: studio.id, label: studio.name }))}
            onChange={(studio) => update({ studio })}
          />
          <ChoiceMenu
            label="Tag"
            value={state.tag}
            options={tags.map((tag) => ({ value: tag, label: tag }))}
            onChange={(tag) => update({ tag })}
          />
          {kind.seriesStatus && (
            <ChoiceMenu
              label="Status"
              value={state.status}
              options={[
                { value: "Continuing", label: "Continuing" },
                { value: "Ended", label: "Ended" },
              ]}
              onChange={(status) => update({ status: status as SeriesStatus | null })}
            />
          )}
          <DropdownMenu.Root>
            <MenuButton active={state.features.length > 0}>
              {state.features.length === 1
                ? FEATURES[state.features[0]!]
                : state.features.length > 1
                  ? `${state.features.length} features`
                  : "Features"}
            </MenuButton>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="start" sideOffset={6} className={MENU_CONTENT}>
                {(Object.keys(FEATURES) as Feature[]).map((feature) => (
                  <DropdownMenu.CheckboxItem
                    key={feature}
                    checked={state.features.includes(feature)}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={(on) =>
                      update({
                        features: on
                          ? [...state.features, feature]
                          : state.features.filter((other) => other !== feature),
                      })
                    }
                    className={MENU_ITEM}
                  >
                    <Indicator />
                    {FEATURES[feature]}
                  </DropdownMenu.CheckboxItem>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </>
      )}

      {kind.filters.map((filter) => {
        const active = state.filters.includes(filter);
        return (
          <button
            key={filter}
            type="button"
            aria-pressed={active}
            onClick={() =>
              update({
                filters: active
                  ? state.filters.filter((f) => f !== filter)
                  : // Watched and Unwatched exclude each other.
                    [
                      ...state.filters.filter(
                        (f) =>
                          !(filter === "played" && f === "unplayed") &&
                          !(filter === "unplayed" && f === "played"),
                      ),
                      filter,
                    ],
              })
            }
            className={cn(
              "h-9 rounded-full px-3.5 text-label-md transition-colors duration-[120ms]",
              active
                ? "bg-primary text-on-primary hover:bg-primary-hover"
                : "bg-surface-raised text-on-surface-muted hover:bg-surface-overlay hover:text-on-surface",
            )}
          >
            {FILTERS[filter]}
          </button>
        );
      })}
      {kind.advancedFilters && (
        <button
          type="button"
          aria-pressed={state.subtitles}
          onClick={() => update({ subtitles: !state.subtitles, resolution: null })}
          title="Can't be combined with a resolution filter"
          className={cn(
            "h-9 rounded-full px-3.5 text-label-md transition-colors duration-[120ms]",
            state.subtitles
              ? "bg-primary text-on-primary hover:bg-primary-hover"
              : "bg-surface-raised text-on-surface-muted hover:bg-surface-overlay hover:text-on-surface",
          )}
        >
          Has subtitles
        </button>
      )}
      <button
        type="button"
        aria-pressed={selecting}
        onClick={onToggleSelecting}
        className={cn(
          "ml-auto inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-label-md transition-colors duration-[120ms]",
          selecting
            ? "bg-primary text-on-primary hover:bg-primary-hover"
            : "bg-surface-raised text-on-surface-muted hover:bg-surface-overlay hover:text-on-surface",
        )}
      >
        <CheckSquare aria-hidden className="size-4" />
        {selecting ? "Done" : "Select"}
      </button>
    </div>
  );
}
