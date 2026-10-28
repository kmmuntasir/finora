import { describe, expect, it } from "vitest";
import { setLanguage, t, tn } from "./index";

describe("t", () => {
  it("returns English text with placeholders filled", () => {
    expect(t("Hello {name}", { name: "Alex" })).toBe("Hello Alex");
    expect(tn(1, "{count} movie", "{count} movies")).toBe("1 movie");
    expect(tn(3, "{count} movie", "{count} movies")).toBe("3 movies");
  });

  it("uses the Bengali catalogue once loaded", async () => {
    await setLanguage("bn");
    expect(t("Sign in")).not.toBe("Sign in");
    await setLanguage("en");
    expect(t("Sign in")).toBe("Sign in");
  });
});
