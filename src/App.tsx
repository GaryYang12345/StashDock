import { lazy, Suspense, useEffect, useSyncExternalStore } from "react";
import { MotionConfig } from "motion/react";
import { isTauri } from "@tauri-apps/api/core";
import { DesktopWindows } from "./components/DesktopWindows";
import { DesktopReady } from './components/DesktopReady';
import { LoadingReferences } from "./components/LoadingReferences";
import { motionTokens } from "./components/arc/lib/motion-tokens";
import { TooltipLayer } from "./components/TooltipLayer";
import { attachKeyboardNavigation } from './lib/keyboardNavigation';
import { DesktopPreferencesProvider } from './features/settings/preferences';

const LibraryView = lazy(() => import("./features/library/LibraryView"));
const DesignLab = lazy(() => import("./features/design/DesignLab"));
const subscribeLocation = (notify: () => void) => { window.addEventListener("popstate", notify); return () => window.removeEventListener("popstate", notify); };
const locationSnapshot = () => window.location.pathname;
const loading = <LoadingReferences />;

export default function App() {
  const pathname = useSyncExternalStore(subscribeLocation, locationSnapshot, () => "/");
  const desktop = pathname !== '/design';
  useEffect(() => { if (desktop) return attachKeyboardNavigation(document); }, [desktop]);
  return <MotionConfig reducedMotion="user" transition={motionTokens.spring.smooth}>
    <TooltipLayer />
    {pathname === "/design" && !isTauri() ? <Suspense fallback={loading}><DesignLab /></Suspense> : isTauri()
      ? <DesktopReady><DesktopPreferencesProvider><DesktopWindows renderLibrary={(collapse, active, maximized, floatingWindow) => <Suspense fallback={loading}><LibraryView onCollapse={collapse} active={active} maximized={maximized} floatingWindow={floatingWindow} /></Suspense>} /></DesktopPreferencesProvider></DesktopReady>
      : <DesktopPreferencesProvider><Suspense fallback={loading}><LibraryView /></Suspense></DesktopPreferencesProvider>}
  </MotionConfig>;
}
