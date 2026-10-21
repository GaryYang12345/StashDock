import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // One React: never resolve packages from copies of the project kept in output/.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }, dedupe: ["react", "react-dom"] },
  // Scan only this project's pages for dependencies. Release checks may leave a
  // full checkout with its own node_modules under output/, and pre-bundling a
  // second React from it leaves the desktop window blank.
  optimizeDeps: { entries: ["**/*.html", "!output/**", "!plugins/stashdock/web/**", "!src-tauri/**"] },
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    strictPort: true,
    proxy: {
      "/v1": "http://127.0.0.1:17863",
    },
    watch: {
      ignored: ["**/src-tauri/**", "**/output/**"],
    },
  },
});
