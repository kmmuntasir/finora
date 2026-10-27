import { afterEach, describe, expect, it, vi } from "vitest";
import { markGoogleAdminSession, useAdminAccess } from "./access";

const session = vi.hoisted(() => ({ user: { Policy: { IsAdministrator: true } } }));
vi.mock("@/features/auth/context", () => ({ useSession: () => session }));

function setSecure(value: boolean) {
  Object.defineProperty(window, "isSecureContext", { value, configurable: true });
}

describe("admin access (decision 0004)", () => {
  afterEach(() => {
    markGoogleAdminSession(false);
    session.user.Policy.IsAdministrator = true;
  });

  it("allows admins on secure pages", () => {
    setSecure(true);
    expect(useAdminAccess()).toEqual({ allowed: true });
  });

  it("locks the console over plain HTTP until Google sign-in", () => {
    setSecure(false);
    expect(useAdminAccess()).toEqual({ allowed: false, reason: "insecure-connection" });
    markGoogleAdminSession(true);
    expect(useAdminAccess()).toEqual({ allowed: true });
  });

  it("refuses non-admins", () => {
    setSecure(true);
    session.user.Policy.IsAdministrator = false;
    expect(useAdminAccess()).toEqual({ allowed: false, reason: "not-admin" });
  });
});
