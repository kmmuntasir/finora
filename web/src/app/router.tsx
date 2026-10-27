import { createBrowserRouter } from "react-router";
import { AppShell } from "./AppShell";
import { HomePage } from "./HomePage";
import { NotFoundPage } from "./NotFoundPage";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [{ index: true, element: <HomePage /> }],
  },
  { path: "*", element: <NotFoundPage /> },
]);
