import { Jellyfin, type Api } from "@jellyfin/sdk";
import axios from "axios";
import { describeDevice, getDeviceId } from "./device";

let instance: Jellyfin | undefined;

/** The shared SDK instance carrying Finora's client and device identity. */
export function getJellyfin(): Jellyfin {
  instance ??= new Jellyfin({
    clientInfo: { name: "Finora", version: __APP_VERSION__ },
    deviceInfo: { name: describeDevice(), id: getDeviceId() },
  });
  return instance;
}

/**
 * Creates an API client for the configured server, optionally authenticated.
 * Each client gets its own Axios instance so interceptors (such as the
 * session-expiry handler) never leak between clients.
 */
export function createJellyfinApi(baseUrl: string, accessToken?: string): Api {
  return getJellyfin().createApi(baseUrl, accessToken, axios.create());
}
