import { afterEach, describe, expect, it, vi } from "vitest";
import { randomId } from "./random-id";

describe("randomId", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("builds a v4 UUID without crypto.randomUUID (plain HTTP)", () => {
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const id = randomId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(randomId()).not.toBe(id);
  });
});
