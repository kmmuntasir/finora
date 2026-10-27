import { createBrowserRouter } from "react-router";
import { RedirectIfSignedIn, RequireAuth } from "@/features/auth/guards";
import { LoginPage } from "@/features/auth/LoginPage";
import { AppShell } from "./AppShell";
import { HomePrototype } from "@/features/home/HomePrototype";
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
          { index: true, element: <HomePrototype /> },
          { path: "server", element: <ServerPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
