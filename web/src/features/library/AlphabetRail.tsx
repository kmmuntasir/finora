import { cn } from "@/lib/cn";
import { LETTERS } from "./library-config";

/** Jump to titles starting with a letter (only when sorted by name). */
export function AlphabetRail({
  active,
  onSelect,
}: {
  active: string | null;
  onSelect: (letter: string | null) => void;
}) {
  return (
    <nav
      aria-label="Jump to letter"
      className="flex flex-wrap gap-1 lg:sticky lg:top-6 lg:flex-col lg:flex-nowrap"
    >
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-pressed={active === null}
        className={cn(
          "grid h-7 min-w-7 place-items-center rounded-full px-2 text-label-sm transition-colors duration-[120ms]",
          active === null
            ? "bg-primary text-on-primary"
            : "text-on-surface-muted hover:bg-surface-raised hover:text-on-surface",
        )}
      >
        All
      </button>
      {LETTERS.map((letter) => (
        <button
          key={letter}
          type="button"
          onClick={() => onSelect(letter === active ? null : letter)}
          aria-pressed={letter === active}
          aria-label={letter === "#" ? "Numbers and symbols" : `Starts with ${letter}`}
          className={cn(
            "grid size-7 place-items-center rounded-full text-label-sm transition-colors duration-[120ms]",
            letter === active
              ? "bg-primary text-on-primary"
              : "text-on-surface-muted hover:bg-surface-raised hover:text-on-surface",
          )}
        >
          {letter}
        </button>
      ))}
    </nav>
  );
}
