import { getBrandingApi } from "@jellyfin/sdk/lib/utils/api/branding-api";
import { getQuickConnectApi } from "@jellyfin/sdk/lib/utils/api/quick-connect-api";
import { getUserApi } from "@jellyfin/sdk/lib/utils/api/user-api";
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

/** Users the server lists on the sign-in screen (not hidden by an admin). */
export function usePublicUsers() {
  const { publicApi } = useRuntimeConfig();
  return useQuery({
    queryKey: ["server", publicApi.basePath, "public-users"],
    queryFn: async () => (await getUserApi(publicApi).getPublicUsers()).data,
    staleTime: 5 * 60 * 1000,
  });
}
