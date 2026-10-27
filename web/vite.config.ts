/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import packageJson from "./package.json" with { type: "json" };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  // JASSUB finds its worker and WebAssembly next to itself (new URL(…, import.meta.url));
  // pre-bundling would move it away from those files.
  optimizeDeps: { exclude: ["jassub"], include: ["jassub > throughput"] },
  worker: { format: "es" },
  resolve: {
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/testing/setup.ts"],
    css: false,
    exclude: ["e2e/**", "node_modules/**"],
  },
});
