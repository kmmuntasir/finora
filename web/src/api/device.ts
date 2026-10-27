const DEVICE_ID_KEY = "finora.deviceId";

/** A stable random ID for this browser, as Jellyfin expects from every client. */
export function getDeviceId(storage: Storage = window.localStorage): string {
  const existing = storage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  storage.setItem(DEVICE_ID_KEY, id);
  return id;
}

/** A readable device name such as "Chrome on Linux", shown in Jellyfin's device list. */
export function describeDevice(userAgent: string = navigator.userAgent): string {
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Browser";
  const os = /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad|iPod/.test(userAgent)
      ? "iOS"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /CrOS/.test(userAgent)
            ? "ChromeOS"
            : /Linux/.test(userAgent)
              ? "Linux"
              : "Unknown OS";
  return `${browser} on ${os}`;
}
