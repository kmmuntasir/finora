import { createBrowserRouter } from "react-router";
import { RedirectIfSignedIn, RequireAuth } from "@/features/auth/guards";
import { LoginPage } from "@/features/auth/LoginPage";
import { AppShell } from "./AppShell";
import { HomePage } from "@/features/home/HomePage";
import { LibrariesPage } from "@/features/library/LibrariesPage";
import { LibraryPage } from "@/features/library/LibraryPage";
import { MePage } from "./MePage";
import { ServerPage } from "./ServerPage";
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
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "libraries", element: <LibrariesPage /> },
          { path: "libraries/:libraryId", element: <LibraryPage /> },
          { path: "server", element: <ServerPage /> },
          { path: "me", element: <MePage /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
