import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { create } from "zustand";

export type RepeatMode = "off" | "all" | "one";

export interface QueueEntry {
  /** Unique per position, so the same song can appear twice. */
  key: string;
  item: BaseItemDto;
}

interface QueueState {
  queue: QueueEntry[];
  /** Index into `queue` of the current entry, or -1. */
  index: number;
  /** Original order, kept while shuffle is on. */
  unshuffled: QueueEntry[] | null;
  repeat: RepeatMode;
  playing: boolean;
  expanded: boolean;
  /** Bumped to ask the engine to restart the current entry (e.g. "play again"). */
  restartToken: number;

  play: (items: BaseItemDto[], startIndex?: number, options?: { shuffle?: boolean }) => void;
  playNext: (items: BaseItemDto[]) => void;
  addToQueue: (items: BaseItemDto[]) => void;
  jumpTo: (index: number) => void;
  next: () => void;
  previous: () => void;
  remove: (index: number) => void;
  move: (from: number, to: number) => void;
  clear: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setPlaying: (playing: boolean) => void;
  setExpanded: (expanded: boolean) => void;
}

let counter = 0;
const entry = (item: BaseItemDto): QueueEntry => ({ key: `${item.Id}-${counter++}`, item });

/** Fisher–Yates shuffle; keeps `first` at the front when given. */
export function shuffleEntries(entries: QueueEntry[], first?: QueueEntry): QueueEntry[] {
  const rest = entries.filter((candidate) => candidate !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  return first ? [first, ...rest] : rest;
}

const playable = (items: BaseItemDto[]) =>
  items.filter((item) => item.Id && item.MediaType === "Audio");

export const useQueue = create<QueueState>()((set, get) => ({
  queue: [],
  index: -1,
  unshuffled: null,
  repeat: "off",
  playing: false,
  expanded: false,
  restartToken: 0,

  play: (items, startIndex = 0, options) => {
    const entries = playable(items).map(entry);
    if (!entries.length) return;
    const start = entries[Math.min(startIndex, entries.length - 1)]!;
    if (options?.shuffle) {
      set({
        queue: shuffleEntries(entries),
        index: 0,
        unshuffled: entries,
        playing: true,
        restartToken: get().restartToken + 1,
      });
    } else {
      set({
        queue: entries,
        index: entries.indexOf(start),
        unshuffled: null,
        playing: true,
        restartToken: get().restartToken + 1,
      });
    }
  },

  playNext: (items) => {
    const { queue, index } = get();
    if (index < 0) return get().play(items);
    const entries = playable(items).map(entry);
    set({ queue: [...queue.slice(0, index + 1), ...entries, ...queue.slice(index + 1)] });
  },

  addToQueue: (items) => {
    if (get().index < 0) return get().play(items);
    set({ queue: [...get().queue, ...playable(items).map(entry)] });
  },

  jumpTo: (index) => {
    if (index < 0 || index >= get().queue.length) return;
    set({ index, playing: true, restartToken: get().restartToken + 1 });
  },

  next: () => {
    const { index, queue, repeat } = get();
    if (repeat === "one") return set({ restartToken: get().restartToken + 1, playing: true });
    if (index + 1 < queue.length) return set({ index: index + 1, playing: true });
    if (repeat === "all" && queue.length)
      return set({ index: 0, playing: true, restartToken: get().restartToken + 1 });
    set({ playing: false });
  },

  previous: () => {
    const { index } = get();
    if (index > 0) set({ index: index - 1, playing: true });
    else set({ restartToken: get().restartToken + 1, playing: true });
  },

  remove: (removeIndex) => {
    const { queue, index } = get();
    const nextQueue = queue.filter((_, position) => position !== removeIndex);
    if (!nextQueue.length) return get().clear();
    if (removeIndex < index) set({ queue: nextQueue, index: index - 1 });
    else if (removeIndex === index)
      set({
        queue: nextQueue,
        index: Math.min(index, nextQueue.length - 1),
        restartToken: get().restartToken + 1,
      });
    else set({ queue: nextQueue });
  },

  move: (from, to) => {
    const { queue, index } = get();
    const nextQueue = [...queue];
    const [moved] = nextQueue.splice(from, 1);
    if (!moved) return;
    nextQueue.splice(to, 0, moved);
    const current = queue[index];
    set({ queue: nextQueue, index: current ? nextQueue.indexOf(current) : index });
  },

  clear: () => set({ queue: [], index: -1, unshuffled: null, playing: false, expanded: false }),

  toggleShuffle: () => {
    const { queue, index, unshuffled } = get();
    const current = queue[index];
    if (unshuffled) {
      set({
        queue: unshuffled,
        index: current ? Math.max(0, unshuffled.indexOf(current)) : 0,
        unshuffled: null,
      });
    } else {
      set({ queue: shuffleEntries(queue, current), index: 0, unshuffled: queue });
    }
  },

  cycleRepeat: () => {
    const order: RepeatMode[] = ["off", "all", "one"];
    set({ repeat: order[(order.indexOf(get().repeat) + 1) % order.length]! });
  },

  setPlaying: (playing) => set({ playing }),
  setExpanded: (expanded) => set({ expanded }),
}));

export const currentEntry = (state: QueueState) => state.queue[state.index] ?? null;
