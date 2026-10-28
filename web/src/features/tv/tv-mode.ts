/** Remote-control navigation is a device setting: a TV needs it, the same account on a laptop doesn't. */
const KEY = "finora.tvMode";

export function readTvMode(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

export function saveTvMode(on: boolean): void {
  window.localStorage.setItem(KEY, on ? "on" : "off");
  document.documentElement.toggleAttribute("data-tv", on);
}

/** Runs before the first render, like the theme. `?tv=1` turns it on for this device. */
export function applyTvMode(): void {
  if (new URLSearchParams(window.location.search).get("tv") === "1") saveTvMode(true);
  document.documentElement.toggleAttribute("data-tv", readTvMode());
}
