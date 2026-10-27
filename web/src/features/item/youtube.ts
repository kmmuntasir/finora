/** "v=abc123" / youtu.be/abc123 → "abc123". */
export function youtubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith("youtu.be")) return parsed.pathname.slice(1) || null;
    if (parsed.hostname.includes("youtube")) {
      return (
        parsed.searchParams.get("v") ??
        parsed.pathname.match(/\/(?:embed|shorts)\/([\w-]+)/)?.[1] ??
        null
      );
    }
  } catch {
    // Not a URL.
  }
  return null;
}
