import { Outlet } from "react-router";
import { AudioEngine } from "@/features/music/AudioEngine";

/** Wraps every signed-in page, so music keeps its single <audio> element across all routes. */
export function SignedInLayout() {
  return (
    <>
      <AudioEngine />
      <Outlet />
    </>
  );
}
