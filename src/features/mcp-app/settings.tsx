import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { App, applyDocumentTheme } from '@modelcontextprotocol/ext-apps';
import { LocaleProvider } from '../settings/locale';
import { resolveLanguage } from '../settings/messages.mjs';
import type { Appearance } from '../settings/SettingsParts';
import { errorText } from '../../lib/errorText';

type Info = { preferences: Appearance; version: string; githubUrl: string | null };
type Host = { theme?: 'light' | 'dark'; locale?: string };
type Value = {
  info: Info | null; loading: boolean; pending: boolean; error: string;
  setClient: (app: App | null) => void; setHost: (host: Host) => void;
  reload: () => Promise<void>; save: (patch: Partial<Appearance>) => Promise<void>;
  call: (name: string, args?: Record<string, unknown>, timeout?: number) => Promise<Record<string, unknown>>;
};
const Context = createContext<Value | null>(null);
function appearance(value: unknown): Appearance {
  const p = value as Appearance | undefined;
  if (!p || !['system', 'en', 'zh'].includes(p.language) || !['system', 'light', 'dark'].includes(p.theme)) throw Error('Settings could not be loaded. Retry.');
  return p;
}
export function McpSettingsProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<App | null>(null), [host, setHost] = useState<Host>({});
  const [info, setInfo] = useState<Info | null>(null), [loading, setLoading] = useState(true), [pending, setPending] = useState(false), [error, setError] = useState('');
  const [systemLanguage, setSystemLanguage] = useState('en');
  const current = useRef(client); current.current = client;
  const generation = useRef(0), flight = useRef(false);
  const call = useCallback(async (name: string, args: Record<string, unknown> = {}, timeout = 10_000) => {
    if (!client) throw Error('StashDock is not connected. Retry the connection.');
    const result = await client.callServerTool({ name, arguments: args }, { timeout });
    if (current.current !== client) throw Error('The connection changed. Retry.');
    if (result.isError) throw Error(result.content.find(block => block.type === 'text')?.text || 'The request failed. Please retry.');
    return result._meta || {};
  }, [client]);
  const reload = useCallback(async () => {
    if (!client) return;
    const request = ++generation.current;
    setLoading(true); setPending(false); setError('');
    try {
      const result = await call('get_stashdock_settings');
      const value = result.settings as Info;
      if (!value || typeof value.version !== 'string' || (value.githubUrl !== null && !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(value.githubUrl))) throw Error('Settings could not be loaded. Retry.');
      const preferences = appearance(value.preferences);
      if (request === generation.current) setInfo({ ...value, preferences });
    } catch (reason) { if (request === generation.current) setError(errorText(reason)); }
    finally { if (request === generation.current) setLoading(false); }
  }, [client, call]);
  useEffect(() => {
    const update = () => setSystemLanguage(navigator.language); update(); window.addEventListener('languagechange', update);
    return () => window.removeEventListener('languagechange', update);
  }, []);
  useEffect(() => {
    if (client) void reload();
    return () => { ++generation.current; };
  }, [client, reload]);
  const preferences = info?.preferences;
  const language = resolveLanguage(preferences?.language ?? 'system', host.locale ?? systemLanguage);
  useEffect(() => {
    const theme = preferences?.theme === 'light' || preferences?.theme === 'dark' ? preferences.theme : host.theme ?? 'light';
    applyDocumentTheme(theme); document.documentElement.style.colorScheme = theme;
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [preferences, host.theme, language]);
  const save = async (patch: Partial<Appearance>) => {
    if (flight.current || !info) return;
    flight.current = true; setPending(true); setError('');
    const request = ++generation.current;
    try {
      const result = await call('save_stashdock_preferences', { preferences: patch });
      const next = appearance(result.preferences);
      if (request === generation.current) setInfo(value => value ? { ...value, preferences: next } : value);
    } catch (reason) { if (request === generation.current) setError(errorText(reason)); throw reason; }
    finally { flight.current = false; if (request === generation.current) setPending(false); }
  };
  return <Context.Provider value={{ info, loading, pending, error, setClient, setHost, reload, save, call }}><LocaleProvider language={language}>{children}</LocaleProvider></Context.Provider>;
}
export function useMcpSettings() {
  const context = useContext(Context);
  if (!context) throw Error('The MCP settings provider is missing.');
  return context;
}
