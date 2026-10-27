import { createBrowserRouter, Navigate } from "react-router";
import { AdminLayout } from "@/features/admin/AdminLayout";
import { LibrariesAdminPage } from "@/features/admin/LibrariesAdminPage";
import { SessionsPage } from "@/features/admin/SessionsPage";
import { UserEditPage } from "@/features/admin/UserEditPage";
import { UsersPage } from "@/features/admin/UsersPage";
import { RedirectIfSignedIn, RequireAuth } from "@/features/auth/guards";
import { LoginPage } from "@/features/auth/LoginPage";
import { AppShell } from "./AppShell";
import { HomePage } from "@/features/home/HomePage";
import { LibrariesPage } from "@/features/library/LibrariesPage";
import { BrowsePage } from "@/features/library/BrowsePage";
import { LibraryPage } from "@/features/library/LibraryPage";
import { ItemPage } from "@/features/item/ItemPage";
import { PlayerPage } from "@/features/player/PlayerPage";
import { SearchPage } from "@/features/search/SearchPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { MePage } from "./MePage";
import { ServerPage } from "./ServerPage";
import { SignedInLayout } from "./SignedInLayout";
import { NotFoundPage } from "./NotFoundPage";

export const router = createBrowserRouter([
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
          { path: "/play/:itemId", element: <PlayerPage /> },
          {
            element: <AppShell />,
            children: [
              { index: true, element: <HomePage /> },
              { path: "libraries", element: <LibrariesPage /> },
              { path: "libraries/:libraryId", element: <LibraryPage /> },
              { path: "items/:itemId", element: <ItemPage /> },
              { path: "search", element: <SearchPage /> },
              { path: "browse", element: <BrowsePage /> },
              { path: "server", element: <ServerPage /> },
              { path: "me", element: <MePage /> },
              { path: "settings", element: <SettingsPage /> },
              {
                path: "admin",
                element: <AdminLayout />,
                children: [
                  { index: true, element: <Navigate to="users" replace /> },
                  { path: "users", element: <UsersPage /> },
                  { path: "users/:userId", element: <UserEditPage /> },
                  { path: "sessions", element: <SessionsPage /> },
                  { path: "libraries", element: <LibrariesAdminPage /> },
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
