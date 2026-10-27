import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { ConfigProvider } from "@/config/ConfigProvider";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { router } from "./router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false },
  },
});

export function App() {
  return (
    <ConfigProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster
            position="bottom-center"
            toastOptions={{
              className: "!bg-surface-overlay !text-on-surface !border-border !font-sans",
            }}
          />
        </AuthProvider>
      </QueryClientProvider>
    </ConfigProvider>
  );
}
