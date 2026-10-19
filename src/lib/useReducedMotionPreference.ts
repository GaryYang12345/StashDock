import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
const snapshot = () => window.matchMedia(query).matches;
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

/** Motion's current hook snapshots the preference on mount. Our moving
 * navigation must also stop when Windows changes it during the session. */
export const useReducedMotionPreference = () => useSyncExternalStore(subscribe, snapshot, () => false);
