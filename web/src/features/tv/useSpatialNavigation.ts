import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { nearestInDirection, type Direction } from "./spatial";
import { readTvMode } from "./tv-mode";

const DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Controls that use the arrow keys themselves. */
const OWNS_ARROWS =
  'input, textarea, select, [role="slider"], [role="menu"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="listbox"], [role="option"], [role="radiogroup"] [role="radio"], [contenteditable="true"]';

function visible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = getComputedStyle(element);
  return style.visibility !== "hidden" && style.display !== "none";
}

/**
 * Arrow keys move focus to the nearest control in that direction, and
 * Escape or the remote's Back key goes back, when TV mode is on for this
 * device. The video player keeps its own arrow-key shortcuts.
 */
export function useSpatialNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const inPlayer = location.pathname.startsWith("/play/");

  useEffect(() => {
    if (inPlayer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!readTvMode() || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey)
        return;
      const active = document.activeElement as HTMLElement | null;
      // Dialogs and menus handle their own keys (Escape closes them).
      const scope: ParentNode =
        document.querySelector('[role="dialog"], [role="alertdialog"]') ?? document;

      if (event.key === "Escape" || event.key === "GoBack" || event.key === "BrowserBack") {
        if (scope !== document || active?.closest(OWNS_ARROWS)) return;
        event.preventDefault();
        void navigate(-1);
        return;
      }

      const direction = DIRECTIONS[event.key];
      if (!direction || active?.closest(OWNS_ARROWS)) return;
      const candidates = [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element !== active && visible(element),
      );
      if (!candidates.length) return;
      event.preventDefault();
      if (!active || active === document.body || !scope.contains(active)) {
        candidates[0]!.focus();
        return;
      }
      const index = nearestInDirection(
        active.getBoundingClientRect(),
        candidates.map((element) => element.getBoundingClientRect()),
        direction,
      );
      const next = candidates[index];
      if (!next) return;
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inPlayer, navigate]);
}
