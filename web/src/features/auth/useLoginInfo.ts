import { getBrandingApi } from "@jellyfin/sdk/lib/utils/api/branding-api";
import { getQuickConnectApi } from "@jellyfin/sdk/lib/utils/api/quick-connect-api";
import { useQuery } from "@tanstack/react-query";
import { useRuntimeConfig } from "@/config/context";

/** Whether Quick Connect is enabled, and the server's login disclaimer. */
export function useLoginInfo() {
  const { publicApi } = useRuntimeConfig();
  const quickConnect = useQuery({
    queryKey: ["server", publicApi.basePath, "quick-connect-enabled"],
    queryFn: async () => (await getQuickConnectApi(publicApi).getQuickConnectEnabled()).data,
    staleTime: 5 * 60 * 1000,
  });
  const branding = useQuery({
    queryKey: ["server", publicApi.basePath, "branding"],
    queryFn: async () => (await getBrandingApi(publicApi).getBrandingOptions()).data,
    staleTime: 5 * 60 * 1000,
  });
  return {
    quickConnectEnabled: quickConnect.data === true,
    disclaimer: branding.data?.LoginDisclaimer?.trim() || null,
  };
}
