import { canonicalReferenceUrl } from './reference-url.mjs';

/** The shared reference URL identity, or the trimmed input if it is not a URL. */
export function canonicalizeUrl(value: string) {
  try {
    return canonicalReferenceUrl(value);
  } catch {
    return value.trim();
  }
}
