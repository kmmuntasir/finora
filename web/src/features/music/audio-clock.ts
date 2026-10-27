import { create } from "zustand";

/** Fast-changing playback position, kept apart from the queue so lists don't re-render every tick. */
interface AudioClock {
  current: number;
  duration: number;
  volume: number;
  muted: boolean;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

export const useAudioClock = create<AudioClock>()(() => ({
  current: 0,
  duration: 0,
  volume: 1,
  muted: false,
  seek: () => undefined,
  setVolume: () => undefined,
  toggleMute: () => undefined,
}));
