export const zh: Record<string, string>;
export function resolveLanguage(preference: string, systemLanguage?: string): 'en' | 'zh';
export function translate(language: 'en' | 'zh', key: string, values?: Record<string, string | number>): string;
