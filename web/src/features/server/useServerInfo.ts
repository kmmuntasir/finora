import { getSystemApi } from "@jellyfin/sdk/lib/utils/api/system-api";
import { useQuery } from "@tanstack/react-query";
import { useRuntimeConfig } from "@/config/context";

/** Public server information; needs no sign-in. */
export function usePublicServerInfo() {
  const { publicApi } = useRuntimeConfig();
  return useQuery({
    queryKey: ["server", publicApi.basePath, "public-info"],
    queryFn: async ({ signal }) => {
      const response = await getSystemApi(publicApi).getPublicSystemInfo({ signal });
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
