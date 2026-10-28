import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { registerServiceWorker } from "./app/service-worker";
import { applyTheme } from "./features/preferences/theme";
import { applyTvMode } from "./features/tv/tv-mode";
import { setLanguage, storedLanguage } from "./i18n";
import "./styles/index.css";

// Before the first render, so the page never flashes the wrong theme.
applyTheme();
applyTvMode();
registerServiceWorker();

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

// Load this device's language first, so the first screen is already in it.
void setLanguage(storedLanguage())
  .catch(() => undefined)
  .finally(() =>
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  );
