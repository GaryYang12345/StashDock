import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// The marketing site. It renders the product's own components (cards, Copy for
// AI, the folder artwork) so the page feels like StashDock, and builds to a
// static folder (website/dist) that any static host can serve.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  resolve: { dedupe: ["react", "react-dom"] },
  plugins: [react()],
  server: { port: 4310, strictPort: true, fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] } },
  build: { outDir: "dist", emptyOutDir: true, rollupOptions: { input: {
    main: fileURLToPath(new URL("index.html", import.meta.url)),
    guide: fileURLToPath(new URL("guide.html", import.meta.url)),
  } } },
  clearScreen: false,
});
