import { Fragment, useEffect } from "react";
import { Outlet } from "react-router";
import { AudioEngine } from "@/features/music/AudioEngine";
import { usePreferences } from "@/features/preferences/preferences";
import { useSpatialNavigation } from "@/features/tv/useSpatialNavigation";
import { currentLanguage, languageLocale, setLanguage } from "@/i18n";
import { setDisplayLocale } from "@/lib/format";

/** Wraps every signed-in page, so music keeps its single <audio> element across all routes. */
export function SignedInLayout() {
  const { preferences, isLoading } = usePreferences();
  useSpatialNavigation();
  // The account's language wins over this device's last one once it's known.
  useEffect(() => {
    if (!isLoading && preferences.language !== currentLanguage())
      void setLanguage(preferences.language);
  }, [isLoading, preferences.language]);
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
