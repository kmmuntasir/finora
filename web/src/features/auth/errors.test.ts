import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";
import { describeSignInError, isUnauthorized } from "./errors";

function httpError(status: number): AxiosError {
  const response = {
    status,
    data: null,
    headers: {},
    statusText: "",
    config: { headers: new AxiosHeaders() },
  };
  return new AxiosError("failed", "ERR", undefined, undefined, response as AxiosResponse);
}

describe("describeSignInError", () => {
  it("explains common failures", () => {
    expect(describeSignInError(httpError(401))).toMatch(/Wrong username or password/);
    expect(describeSignInError(httpError(503))).toMatch(/server had a problem/);
    expect(describeSignInError(new AxiosError("Network Error"))).toMatch(/Can't reach the server/);
    expect(describeSignInError(new Error("x"))).toMatch(/Sign-in failed/);
  });

  it("detects 401 responses", () => {
    expect(isUnauthorized(httpError(401))).toBe(true);
    expect(isUnauthorized(httpError(500))).toBe(false);
  });
});
