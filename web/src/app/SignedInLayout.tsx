import { Fragment, useEffect } from "react";
import { Outlet } from "react-router";
import { AudioEngine } from "@/features/music/AudioEngine";
import { usePreferences, useSetPreference } from "@/features/preferences/preferences";
import { useSpatialNavigation } from "@/features/tv/useSpatialNavigation";
import { currentLanguage, languageLocale, setLanguage } from "@/i18n";
import { setDisplayLocale } from "@/lib/format";

/** Wraps every signed-in page, so music keeps its single <audio> element across all routes. */
export function SignedInLayout() {
  const { preferences, isLoading, isSaved } = usePreferences();
  const setPreference = useSetPreference();
  const languageSaved = isSaved("language");
  useSpatialNavigation();
  // The account's language wins over this device's once it's known. An account
  // that never chose one adopts the language picked on this device (e.g. on
  // the sign-in page).
  useEffect(() => {
    if (isLoading) return;
    if (!languageSaved) {
      if (currentLanguage() !== "en") setPreference.mutate({ language: currentLanguage() });
      return;
    }
    if (preferences.language !== currentLanguage()) void setLanguage(preferences.language);
    // setPreference is a new object each render; the saved state is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, languageSaved, preferences.language]);
  // Formatting helpers read the locale synchronously; pages re-render when it changes.
  // "Same as this browser" follows the interface language when that isn't English.
  setDisplayLocale(
    preferences.dateLocale === "auto" && preferences.language !== "en"
      ? languageLocale(preferences.language)
      : preferences.dateLocale,
  );
  return (
    <>
      <AudioEngine />
      <Fragment key={preferences.dateLocale}>
        <Outlet />
      </Fragment>
    </>
  );
}
