/**
 * Registers the service worker that makes Finora installable. Browsers only
 * allow service workers in secure contexts, so plain-HTTP deployments skip it
 * (decision 0003). Development builds skip it too, to keep Vite's HMR simple.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !window.isSecureContext || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installation is optional; the app works without it.
    });
  });
}
