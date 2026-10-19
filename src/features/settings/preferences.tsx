import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LocaleProvider } from './locale';
import { resolveLanguage } from './messages.mjs';

export type DesktopPreferences = { language: 'system' | 'en' | 'zh'; theme: 'system' | 'light' | 'dark'; shortcut: string; floatingWindow: boolean };
export type SettingsInfo = { preferences: DesktopPreferences; launchAtLogin: boolean; version: string; githubUrl: string | null; systemLanguage?: string };
const DEFAULT: DesktopPreferences = { language: 'system', theme: 'system', shortcut: 'Ctrl+Shift+Space', floatingWindow: true };
const CACHE = 'stashdock.desktop-appearance.v1';
function cached(): DesktopPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE) || 'null');
    if (value && ['system', 'en', 'zh'].includes(value.language) && ['system', 'light', 'dark'].includes(value.theme)) return { ...DEFAULT, language: value.language, theme: value.theme };
  } catch { /* Optional appearance cache. Native settings remain authoritative. */ }
  return DEFAULT;
}
export function applyDesktopAppearance(preferences: DesktopPreferences, systemLanguage = navigator.language) {
  const theme = preferences.theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : preferences.theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.lang = resolveLanguage(preferences.language, systemLanguage) === 'zh' ? 'zh-CN' : 'en';
  document.documentElement.style.colorScheme = theme;
}
// Called by the desktop-only entry point before paint, not during React render.
export function primeDesktopAppearance() { applyDesktopAppearance(cached()); }

type Value = { info: SettingsInfo | null; loading: boolean; pending: boolean; error: string; reload: () => Promise<void>; save: (patch: Partial<DesktopPreferences>) => Promise<void>; setStartup: (enabled: boolean) => Promise<void> };
const Context = createContext<Value | null>(null);
export function DesktopPreferencesProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<SettingsInfo | null>(null);
  const [loading, setLoading] = useState(true), [pending, setPending] = useState(false), [error, setError] = useState('');
  const [systemLanguage, setSystemLanguage] = useState('en');
  const alive = useRef(true), flight = useRef(false), generation = useRef(0);
  const earlyPreferences = useRef<DesktopPreferences | null>(null);
  const current = useRef(info); current.current = info;
  const reload = useCallback(async () => {
    const version = ++generation.current;
    earlyPreferences.current = null;
    setLoading(true); setError('');
    try {
      const value = isTauri() ? await invoke<SettingsInfo>('get_desktop_settings') : { preferences: cached(), launchAtLogin: false, version: '0.2.5', githubUrl: null };
      if (alive.current && generation.current === version) {
        setInfo({ ...value, preferences: earlyPreferences.current ?? value.preferences });
        earlyPreferences.current = null;
      }
    } catch (reason) { if (alive.current && generation.current === version) setError(String(reason)); }
    finally { if (alive.current && generation.current === version) setLoading(false); }
  }, []);
  useEffect(() => {
    alive.current = true; let disposed = false; let unlisten: (() => void) | undefined;
    const language = () => setSystemLanguage(navigator.language); language(); window.addEventListener('languagechange', language);
    void (async () => {
      if (isTauri()) {
        const stop = await listen<DesktopPreferences>('desktop-preferences-changed', event => {
          if (disposed) return;
          // The other native window may save before this window's initial
          // settings read finishes. Retain that event without invalidating
          // the only request capable of filling the rest of SettingsInfo.
          if (!current.current) { earlyPreferences.current = event.payload; return; }
          ++generation.current; setLoading(false);
          setInfo(current => current ? { ...current, preferences: event.payload } : current);
        });
        if (disposed) { stop(); return; } unlisten = stop;
      }
      if (!disposed) await reload();
    })().catch(reason => { if (!disposed) { setError(String(reason)); setLoading(false); } });
    return () => { disposed = true; alive.current = false; ++generation.current; unlisten?.(); window.removeEventListener('languagechange', language); };
  }, [reload]);
  const preferences = info?.preferences ?? DEFAULT;
  useEffect(() => {
    // Keep the pre-paint appearance cache until the authoritative native read
    // arrives. Applying DEFAULT here would flash light between two dark frames.
    if (!info) return;
    const apply = () => applyDesktopAppearance(preferences, info?.systemLanguage ?? systemLanguage);
    apply();
    const media = matchMedia('(prefers-color-scheme: dark)'); media.addEventListener('change', apply);
    if (info) try { localStorage.setItem(CACHE, JSON.stringify({ language: preferences.language, theme: preferences.theme })); } catch { /* Cache is not required. */ }
    if (isTauri()) void getCurrentWindow().setTheme(preferences.theme === 'system' ? null : preferences.theme).catch(console.warn);
    return () => media.removeEventListener('change', apply);
  }, [preferences.language, preferences.theme, Boolean(info), info?.systemLanguage, systemLanguage]);
  const save = async (patch: Partial<DesktopPreferences>) => {
    if (flight.current || !current.current) return;
    flight.current = true; setPending(true); setError('');
    const preferences = { ...current.current.preferences, ...patch };
    try {
      const value = isTauri() ? await invoke<DesktopPreferences>('save_desktop_preferences', { preferences }) : preferences;
      if (alive.current) setInfo(current => current ? { ...current, preferences: value } : current);
    } catch (reason) { if (alive.current) setError(String(reason)); throw reason; }
    finally { flight.current = false; if (alive.current) setPending(false); }
  };
  const setStartup = async (enabled: boolean) => {
    if (flight.current || !current.current) return;
    flight.current = true; setPending(true); setError('');
    try {
      const value = await invoke<boolean>('set_launch_at_login', { enabled });
      if (alive.current) setInfo(current => current ? { ...current, launchAtLogin: value } : current);
    } catch (reason) { if (alive.current) setError(String(reason)); throw reason; }
    finally { flight.current = false; if (alive.current) setPending(false); }
  };
  return <Context.Provider value={{ info, loading, pending, error, reload, save, setStartup }}><LocaleProvider language={resolveLanguage(preferences.language, info?.systemLanguage ?? systemLanguage)}>{children}</LocaleProvider></Context.Provider>;
}
export function useDesktopPreferences() {
  const value = useContext(Context); if (!value) throw Error('Desktop preferences require the desktop provider.'); return value;
}
