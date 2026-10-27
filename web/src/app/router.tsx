import { createBrowserRouter } from "react-router";
import { RedirectIfSignedIn, RequireAuth } from "@/features/auth/guards";
import { LoginPage } from "@/features/auth/LoginPage";
import { AppShell } from "./AppShell";
import { HomePage } from "./HomePage";
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
        children: [{ index: true, element: <HomePage /> }],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
