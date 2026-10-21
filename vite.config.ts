import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // One React: never resolve packages from copies of the project kept in output/.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }, dedupe: ["react", "react-dom"] },
  // Scan only this project's own pages for dependencies. A whole-tree scan is
  // slow on Windows and also reached a release-check checkout under output/,
  // whose second React left the desktop window blank.
  optimizeDeps: { entries: ["index.html", "src/features/mcp-app/index.html", "extension/sidepanel.html", "tests/fixtures/*.html"] },
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
