import { describe, expect, it } from "vitest";
import { describeDevice, getDeviceId } from "./device";

describe("getDeviceId", () => {
  it("creates an ID once and reuses it", () => {
    const storage = window.localStorage;
    storage.clear();
    const first = getDeviceId(storage);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(getDeviceId(storage)).toBe(first);
  });
});

describe("describeDevice", () => {
  it.each([
    [
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
      "Chrome on Linux",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0",
      "Firefox on Windows",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      "Safari on iOS",
    ],
    [
      "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36",
      "Chrome on Android",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 Edg/140.0",
      "Edge on Windows",
    ],
  ])("%s", (userAgent, expected) => {
    expect(describeDevice(userAgent)).toBe(expected);
  });
});
