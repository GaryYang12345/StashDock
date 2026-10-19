// Chromium makes a pointer-focused control :focus-visible on bare Shift.
// Keep Arc's keyboard ring, but only enable it after intentional navigation.
const navigationKeys = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', ' ', 'Escape', 'F6']);

export function isFocusNavigationKey(key: string) { return navigationKeys.has(key); }

export function attachKeyboardNavigation(doc: Document) {
  const root = doc.documentElement;
  const previous = root.dataset.desktopFocus;
  root.dataset.desktopFocus = 'pointer';
  const pointer = () => { root.dataset.desktopFocus = 'pointer'; };
  const key = (event: KeyboardEvent) => {
    if (!event.isComposing && isFocusNavigationKey(event.key)) root.dataset.desktopFocus = 'keyboard';
  };
  const options = { capture: true };
  doc.addEventListener('pointerdown', pointer, options);
  doc.addEventListener('keydown', key, options);
  return () => {
    doc.removeEventListener('pointerdown', pointer, options);
    doc.removeEventListener('keydown', key, options);
    if (previous === undefined) delete root.dataset.desktopFocus;
    else root.dataset.desktopFocus = previous;
  };
}
