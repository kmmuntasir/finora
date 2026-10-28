import { Fragment } from "react";
import { Outlet } from "react-router";
import { AudioEngine } from "@/features/music/AudioEngine";
import { usePreferences } from "@/features/preferences/preferences";
import { useSpatialNavigation } from "@/features/tv/useSpatialNavigation";
import { setDisplayLocale } from "@/lib/format";

/** Wraps every signed-in page, so music keeps its single <audio> element across all routes. */
export function SignedInLayout() {
  const { preferences } = usePreferences();
  useSpatialNavigation();
  // Formatting helpers read the locale synchronously; pages re-render when it changes.
  setDisplayLocale(preferences.dateLocale);
  return (
    <>
      <AudioEngine />
      <Fragment key={preferences.dateLocale}>
        <Outlet />
      </Fragment>
    </>
  );
}
