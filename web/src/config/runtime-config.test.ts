import { describe, expect, it } from "vitest";
import { loadRuntimeConfig, normalizeBaseUrl, parseRuntimeConfig } from "./runtime-config";

describe("normalizeBaseUrl", () => {
  it("drops trailing slashes, query and hash", () => {
    expect(normalizeBaseUrl(" http://10.0.0.1:8096/// ")).toBe("http://10.0.0.1:8096");
    expect(normalizeBaseUrl("https://media.example.com/jellyfin/?a=1#x")).toBe(
      "https://media.example.com/jellyfin",
    );
  });

  it("rejects other protocols and embedded credentials", () => {
    expect(() => normalizeBaseUrl("ftp://example.com")).toThrow(/protocol/);
    expect(() => normalizeBaseUrl("http://user:pass@example.com")).toThrow(/Credentials/);
    expect(() => normalizeBaseUrl("not a url")).toThrow();
  });
});

describe("parseRuntimeConfig", () => {
  it("accepts an HTTP Jellyfin from an HTTP page", () => {
    const result = parseRuntimeConfig({ jellyfinUrl: "http://10.0.0.1:8096/" }, "http:");
    expect(result).toEqual({
      ok: true,
      config: { jellyfinUrl: "http://10.0.0.1:8096", apiUrl: null },
    });
  });

  it("accepts an HTTPS API from an HTTP page", () => {
    const result = parseRuntimeConfig(
      { jellyfinUrl: "http://10.0.0.1:8096", apiUrl: "https://api.example.com/" },
      "http:",
    );
    expect(result.ok && result.config.apiUrl).toBe("https://api.example.com");
  });

  it("rejects HTTP URLs from an HTTPS page", () => {
    expect(parseRuntimeConfig({ jellyfinUrl: "http://10.0.0.1:8096" }, "https:")).toEqual({
      ok: false,
      problem: { kind: "insecure-mix", field: "jellyfinUrl", url: "http://10.0.0.1:8096" },
    });
    const apiResult = parseRuntimeConfig(
      { jellyfinUrl: "https://media.example.com", apiUrl: "http://api.example.com" },
      "https:",
    );
    expect(
      !apiResult.ok && apiResult.problem.kind === "insecure-mix" && apiResult.problem.field,
    ).toBe("apiUrl");
  });

  it("treats an empty apiUrl as absent", () => {
    const result = parseRuntimeConfig(
      { jellyfinUrl: "https://m.example.com", apiUrl: "" },
      "https:",
    );
    expect(result.ok && result.config.apiUrl).toBeNull();
  });

  it("reports invalid shapes", () => {
    expect(parseRuntimeConfig(null, "http:").ok).toBe(false);
    expect(parseRuntimeConfig({}, "http:").ok).toBe(false);
    expect(parseRuntimeConfig({ jellyfinUrl: "x", apiUrl: 3 }, "http:").ok).toBe(false);
  });
});

describe("loadRuntimeConfig", () => {
  it("reports a missing file", async () => {
    const fetchImpl = async () => new Response("", { status: 404 });
    const result = await loadRuntimeConfig(fetchImpl as typeof fetch, "http:");
    expect(!result.ok && result.problem.kind).toBe("missing");
  });

  it("reports malformed JSON", async () => {
    const fetchImpl = async () => new Response("{", { status: 200 });
    const result = await loadRuntimeConfig(fetchImpl as typeof fetch, "http:");
    expect(!result.ok && result.problem.kind).toBe("invalid");
  });
});
