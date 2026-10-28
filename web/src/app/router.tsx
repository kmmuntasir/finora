import { createBrowserRouter, Navigate } from "react-router";
import { RedirectIfSignedIn, RequireAuth } from "@/features/auth/guards";
import { LoginPage } from "@/features/auth/LoginPage";
import { HomePage } from "@/features/home/HomePage";
import { AppShell } from "./AppShell";
import { NotFoundPage } from "./NotFoundPage";
import { SignedInLayout } from "./SignedInLayout";

/**
 * Sign-in, the shell and home load up front; every other page is its own
 * chunk, fetched on first visit (the player alone brings hls.js and JASSUB).
 */
const page = <T extends Record<string, React.ComponentType>>(
  load: () => Promise<T>,
  name: keyof T,
) => ({
  lazy: async () => ({ Component: (await load())[name] }),
});

export const router = createBrowserRouter([
  {
    path: "/auth/google",
    ...page(() => import("@/features/auth/GoogleCallbackPage"), "GoogleCallbackPage"),
  },
  {
    element: <RedirectIfSignedIn />,
    children: [{ path: "/login", element: <LoginPage /> }],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <SignedInLayout />,
        children: [
          {
            path: "/play/:itemId",
            ...page(() => import("@/features/player/PlayerPage"), "PlayerPage"),
          },
          {
            element: <AppShell />,
            children: [
              { index: true, element: <HomePage /> },
              {
                path: "libraries",
                ...page(() => import("@/features/library/LibrariesPage"), "LibrariesPage"),
              },
              {
                path: "libraries/:libraryId",
                ...page(() => import("@/features/library/LibraryPage"), "LibraryPage"),
              },
              {
                path: "items/:itemId",
                ...page(() => import("@/features/item/ItemPage"), "ItemPage"),
              },
              {
                path: "search",
                ...page(() => import("@/features/search/SearchPage"), "SearchPage"),
              },
              {
                path: "browse",
                ...page(() => import("@/features/library/BrowsePage"), "BrowsePage"),
              },
              { path: "server", ...page(() => import("./ServerPage"), "ServerPage") },
              { path: "me", ...page(() => import("./MePage"), "MePage") },
              {
                path: "settings",
                ...page(() => import("@/features/settings/SettingsPage"), "SettingsPage"),
              },
              {
                path: "admin",
                ...page(() => import("@/features/admin/AdminLayout"), "AdminLayout"),
                children: [
                  { index: true, element: <Navigate to="overview" replace /> },
                  {
                    path: "overview",
                    ...page(() => import("@/features/admin/OverviewPage"), "OverviewPage"),
                  },
                  {
                    path: "activity",
                    ...page(() => import("@/features/admin/ActivityPage"), "ActivityPage"),
                  },
                  {
                    path: "users",
                    ...page(() => import("@/features/admin/UsersPage"), "UsersPage"),
                  },
                  {
                    path: "users/:userId",
                    ...page(() => import("@/features/admin/UserEditPage"), "UserEditPage"),
                  },
                  {
                    path: "sessions",
                    ...page(() => import("@/features/admin/SessionsPage"), "SessionsPage"),
                  },
                  {
                    path: "libraries",
                    ...page(
                      () => import("@/features/admin/LibrariesAdminPage"),
                      "LibrariesAdminPage",
                    ),
                  },
                  {
                    path: "finora",
                    ...page(() => import("@/features/admin/FinoraAdminPage"), "FinoraAdminPage"),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
