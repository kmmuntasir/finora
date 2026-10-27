/**
 * Runtime configuration, loaded from `/config.json` next to `index.html` so
 * one build works in every deployment (see docs/concept.md, section 7.4).
 */

export interface RuntimeConfig {
  /** The single Jellyfin address used by browsers. No trailing slash. */
  jellyfinUrl: string;
  /** Optional Finora API base URL. No trailing slash. */
  apiUrl: string | null;
}

export type ConfigProblem =
  | { kind: "missing"; detail: string }
  | { kind: "invalid"; detail: string }
  | { kind: "insecure-mix"; field: "jellyfinUrl" | "apiUrl"; url: string };

export type ConfigResult =
  { ok: true; config: RuntimeConfig } | { ok: false; problem: ConfigProblem };

/** Normalises a user-supplied base URL: requires http(s), drops trailing slashes. */
export function normalizeBaseUrl(raw: string): string {
  const url = new URL(raw.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported protocol "${url.protocol}"`);
  }
  if (url.username || url.password) {
    throw new Error("Credentials are not allowed in the URL");
  }
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/+$/, "");
}

/** Validates the parsed JSON and checks it against the page's own protocol. */
export function parseRuntimeConfig(data: unknown, pageProtocol: string): ConfigResult {
  if (typeof data !== "object" || data === null) {
    return {
      ok: false,
      problem: { kind: "invalid", detail: "config.json must contain an object" },
    };
  }
  const record = data as Record<string, unknown>;

  if (typeof record.jellyfinUrl !== "string" || record.jellyfinUrl.trim() === "") {
    return { ok: false, problem: { kind: "invalid", detail: "jellyfinUrl is required" } };
  }
  if (record.apiUrl !== undefined && record.apiUrl !== null && typeof record.apiUrl !== "string") {
    return { ok: false, problem: { kind: "invalid", detail: "apiUrl must be a string or null" } };
  }

  let config: RuntimeConfig;
  try {
    config = {
      jellyfinUrl: normalizeBaseUrl(record.jellyfinUrl),
      apiUrl:
        typeof record.apiUrl === "string" && record.apiUrl.trim() !== ""
          ? normalizeBaseUrl(record.apiUrl)
          : null,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, problem: { kind: "invalid", detail } };
  }

  // Browsers block http:// requests from an https:// page (mixed content).
  if (pageProtocol === "https:") {
    for (const field of ["jellyfinUrl", "apiUrl"] as const) {
      const url = config[field];
      if (url?.startsWith("http:")) {
        return { ok: false, problem: { kind: "insecure-mix", field, url } };
      }
    }
  }

  return { ok: true, config };
}

export async function loadRuntimeConfig(
  fetchImpl: typeof fetch = fetch,
  pageProtocol: string = window.location.protocol,
): Promise<ConfigResult> {
  let response: Response;
  try {
    response = await fetchImpl("/config.json", { cache: "no-store" });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, problem: { kind: "missing", detail } };
  }
  if (!response.ok) {
    return {
      ok: false,
      problem: { kind: "missing", detail: `GET /config.json returned ${response.status}` },
    };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { ok: false, problem: { kind: "invalid", detail: "config.json is not valid JSON" } };
  }
  return parseRuntimeConfig(data, pageProtocol);
}
