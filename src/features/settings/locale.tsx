import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { translate } from './messages.mjs';

export type InterfaceLanguage = 'en' | 'zh';
export type Translate = (key: string, values?: Record<string, string | number>) => string;
const LocaleContext = createContext<InterfaceLanguage>('en');
export function LocaleProvider({ language, children }: { language: InterfaceLanguage; children: ReactNode }) {
  return <LocaleContext.Provider value={language}>{children}</LocaleContext.Provider>;
}
export function useI18n() {
  const language = useContext(LocaleContext);
  return useMemo(() => ({ language, t: ((key, values) => translate(language, key, values)) as Translate }), [language]);
}
