import { beforeEach, describe, expect, it } from "vitest";
import { clearSession, readSession, writeSession, type StoredSession } from "./session-storage";

const session: StoredSession = {
  serverUrl: "http://media.example.com:8096",
  userId: "u1",
  userName: "alex",
  accessToken: "token-1",
};

describe("session storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("remembers in localStorage only when asked", () => {
    writeSession(session, true);
    expect(window.localStorage.getItem("finora.session")).not.toBeNull();
    expect(window.sessionStorage.getItem("finora.session")).toBeNull();

    writeSession(session, false);
    expect(window.localStorage.getItem("finora.session")).toBeNull();
    expect(window.sessionStorage.getItem("finora.session")).not.toBeNull();
    expect(readSession(session.serverUrl)).toEqual(session);
  });

  it("ignores sessions for a different server", () => {
    writeSession(session, true);
    expect(readSession("http://other.example.com")).toBeNull();
  });

  it("drops corrupt entries", () => {
    window.localStorage.setItem("finora.session", "{oops");
    expect(readSession(session.serverUrl)).toBeNull();
    expect(window.localStorage.getItem("finora.session")).toBeNull();
  });

  it("clears both storages", () => {
    writeSession(session, true);
    clearSession();
    expect(readSession(session.serverUrl)).toBeNull();
  });
});
