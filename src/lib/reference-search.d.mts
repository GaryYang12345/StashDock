export const MAX_SEARCH_TERMS: number;
export const MAX_TERM_CHARACTERS: number;
export function searchTerms(query: string | null | undefined): string[];
export function referenceSearchText(item: {
  title?: string; source?: string; url?: string; excerpt?: string; tags?: string[];
  content?: string; contextOverride?: string; assetPath?: string; hasFile?: boolean;
}): string;
export function matchesSearchTerms(text: string, terms: string[]): boolean;
export function searchStatement(terms: string[]): { sql: string; params: string[] };
