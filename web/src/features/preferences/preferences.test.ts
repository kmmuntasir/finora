import { describe, expect, it } from "vitest";
import { parsePreferences } from "./preferences";

describe("parsePreferences", () => {
  it("reads valid values and falls back for invalid ones", () => {
    expect(parsePreferences({ homeLayout: "focus" }).homeLayout).toBe("focus");
    expect(parsePreferences({ homeLayout: "grid" }).homeLayout).toBe("spotlight");
    expect(parsePreferences(null).homeLayout).toBe("spotlight");
  });
});

describe("parsePreferences (other keys)", () => {
  it("keeps valid choices and drops invalid ones", () => {
    const parsed = parsePreferences({ subtitleSize: "large", skipSegments: "sideways" });
    expect(parsed.subtitleSize).toBe("large");
    expect(parsed.skipSegments).toBe("button");
    expect(parsed.dateLocale).toBe("auto");
  });
});
