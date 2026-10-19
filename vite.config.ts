import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    strictPort: true,
    proxy: {
      "/v1": "http://127.0.0.1:17863",
    },
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
