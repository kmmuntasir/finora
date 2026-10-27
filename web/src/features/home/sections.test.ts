import { describe, expect, it } from "vitest";
import { parseHomeSections, serializeHomeSections } from "./sections";

describe("home sections", () => {
  it("defaults to every section in order", () => {
    expect(serializeHomeSections(parseHomeSections(""))).toBe("resume,nextup,listening,latest");
  });

  it("keeps order and hidden flags, drops unknown ids, appends missing ones", () => {
    const sections = parseHomeSections("latest,-resume,bogus,latest");
    expect(serializeHomeSections(sections)).toBe("latest,-resume,nextup,listening");
  });
});
