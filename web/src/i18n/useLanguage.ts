import { useSyncExternalStore } from "react";
import { currentLanguage, subscribeLanguage } from "./index";

/** The interface language; components keyed on it re-render with new text. */
export function useLanguage() {
  return useSyncExternalStore(subscribeLanguage, currentLanguage);
}
