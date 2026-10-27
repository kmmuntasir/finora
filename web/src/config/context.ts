import { createContext, useContext } from "react";
import type { Api } from "@jellyfin/sdk";
import type { RuntimeConfig } from "./runtime-config";

export interface ConfigContextValue {
  config: RuntimeConfig;
  /** Unauthenticated Jellyfin client for public endpoints. */
  publicApi: Api;
}

export const ConfigContext = createContext<ConfigContextValue | null>(null);

export function useRuntimeConfig(): ConfigContextValue {
  const value = useContext(ConfigContext);
  if (!value) throw new Error("useRuntimeConfig must be used inside <ConfigProvider>");
  return value;
}
