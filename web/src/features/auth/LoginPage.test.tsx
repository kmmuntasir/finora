import type { Api } from "@jellyfin/sdk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ConfigContext } from "@/config/context";
import { AuthContext, type AuthContextValue } from "./context";
import { LoginPage } from "./LoginPage";

function renderLogin(authenticateUserByName: Api["authenticateUserByName"]) {
  const completeSignIn = vi.fn();
  const publicApi = {
    basePath: "http://media.example.com",
    authenticateUserByName,
    // Public info, Quick Connect and branding queries fail quietly in tests.
    axiosInstance: { request: vi.fn().mockRejectedValue(new Error("offline")) },
    configuration: {},
  } as unknown as Api;
  const auth: AuthContextValue = {
    state: { status: "signed-out" },
    completeSignIn,
    signOut: vi.fn(),
    retryRestore: vi.fn(),
    refreshUser: vi.fn(),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <ConfigContext.Provider
      value={{ config: { jellyfinUrl: "http://media.example.com", apiUrl: null }, publicApi }}
    >
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={auth}>
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    </ConfigContext.Provider>,
  );
  return { completeSignIn };
}

describe("LoginPage", () => {
  it("signs in with username and password", async () => {
    const result = { AccessToken: "t", User: { Id: "u", Name: "alex" } };
    const authenticate = vi.fn().mockResolvedValue({ data: result });
    const { completeSignIn } = renderLogin(authenticate);

    await userEvent.type(screen.getByLabelText("Username"), " alex ");
    await userEvent.type(screen.getByLabelText("Password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(authenticate).toHaveBeenCalledWith("alex", "secret");
    expect(completeSignIn).toHaveBeenCalledWith(result, true);
  });

  it("shows a clear error for wrong credentials", async () => {
    const response = { status: 401, config: { headers: new AxiosHeaders() } } as AxiosResponse;
    const authenticate = vi
      .fn()
      .mockRejectedValue(new AxiosError("401", "ERR", undefined, undefined, response));
    const { completeSignIn } = renderLogin(authenticate);

    await userEvent.type(screen.getByLabelText("Username"), "alex");
    await userEvent.click(screen.getByLabelText("Keep me signed in on this device"));
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong username or password.");
    expect(completeSignIn).not.toHaveBeenCalled();
  });

  it("toggles password visibility", async () => {
    renderLogin(vi.fn());
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
  });
});
