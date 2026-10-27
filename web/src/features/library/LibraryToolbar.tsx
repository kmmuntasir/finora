import { ArrowDownUp, Check, ChevronDown } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { FILTERS, SORTS, type LibraryKind, type SortKey } from "./library-config";
import type { LibraryState } from "./library-state";

interface LibraryToolbarProps {
  kind: LibraryKind;
  state: LibraryState;
  update: (changes: Partial<LibraryState>) => void;
  genres: string[];
}

const MENU_CONTENT =
  "z-50 max-h-[min(70vh,28rem)] min-w-48 overflow-y-auto rounded-lg bg-surface-overlay p-1.5 shadow-[0_8px_24px_rgb(0_0_0/0.5)] ring-1 ring-border";
const MENU_ITEM =
  "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-body-sm outline-none select-none data-[highlighted]:bg-surface-raised";

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

export function LibraryToolbar({ kind, state, update, genres }: LibraryToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
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
    </div>
  );
}
