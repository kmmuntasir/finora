export type ThemeChoice = "dark" | "light" | "system";

const KEY = "finora.theme";

export function readTheme(): ThemeChoice {
  const saved = window.localStorage.getItem(KEY);
  return saved === "light" || saved === "system" ? saved : "dark";
}

function resolve(choice: ThemeChoice): "dark" | "light" {
  if (choice !== "system") return choice;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

let stopFollowingSystem: (() => void) | undefined;

/** Applies the theme to <html>; "system" follows the OS setting live. */
export function applyTheme(choice: ThemeChoice = readTheme()): void {
  const root = document.documentElement;
  const update = () => {
    if (resolve(choice) === "light") root.dataset.theme = "light";
    else delete root.dataset.theme;
    const background = getComputedStyle(root).getPropertyValue("--fin-background").trim();
    if (background)
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", background);
  };
  stopFollowingSystem?.();
  stopFollowingSystem = undefined;
  update();
  if (choice === "system") {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    media.addEventListener("change", update);
    stopFollowingSystem = () => media.removeEventListener("change", update);
  }
}

export function saveTheme(choice: ThemeChoice): void {
  window.localStorage.setItem(KEY, choice);
}
