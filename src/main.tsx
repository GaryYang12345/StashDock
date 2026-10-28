import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/geist";
import "./components/arc/foundation.css";
import { isTauri } from "@tauri-apps/api/core";
import { desktopSurface } from "./lib/desktopWindows";
import { primeDesktopAppearance } from './features/settings/preferences';

// Set native host styles before the first render, avoiding an opaque folder flash.
primeDesktopAppearance();
if (isTauri()) {
  // Native host hint before paint; authoritative settings arrive from Rust.
  document.documentElement.dataset.desktopPlatform = /Mac/.test(navigator.platform) ? "macos" : "other";
  const surface = desktopSurface();
  const host = surface === "folder" ? "desktop-folder" : surface === "search" ? "desktop-search" : "desktop-native";
  document.documentElement.classList.add(host);
  document.body.classList.add(host);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
