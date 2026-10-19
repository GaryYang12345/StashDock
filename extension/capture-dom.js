// Shared, bounded DOM-only reader. Never collect hidden state or form values.
export const EXCLUDE = 'script,style,noscript,template,nav,aside,footer,form,input,textarea,select,button,[contenteditable],[hidden],[aria-hidden="true"],[role="navigation"]';
const BLOCK = /^(P|DIV|SECTION|ARTICLE|MAIN|H[1-6]|LI|PRE|BLOCKQUOTE|TR|BR)$/;
export const normalize = text => String(text || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
export const hostIs = (host, domain) => host === domain || host.endsWith(`.${domain}`);

export function visible(element, doc, { allowDialog = false } = {}) {
  if (element.matches(EXCLUDE) || (!allowDialog && element.matches('[role="dialog"]'))) return false;
  const style = doc.defaultView?.getComputedStyle(element);
  return !style || (style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse');
}

export function renderedRoot(element, doc, options) {
  for (let node = element; node; node = node.parentElement) {
    if (!visible(node, doc, options)) return false;
  }
  return Boolean(element);
}

export function renderedText(root, doc = root?.ownerDocument, options = {}) {
  if (!renderedRoot(root, doc, options)) return '';
  let visits = 0, chars = 0;
  const walk = node => {
    if (++visits > 10_000 || chars >= 100_000) return '';
    if (node.nodeType === 3) { chars += node.textContent.length; return node.textContent; }
    if (node.nodeType !== 1 || !visible(node, doc, options) || (options.exclude && node.matches(options.exclude))) return '';
    if (node.tagName === 'BR') return '\n';
    const text = [...node.childNodes].map(walk).join('');
    return BLOCK.test(node.tagName) ? `\n${text}\n` : text;
  };
  return normalize(walk(root));
}

export function firstVisible(root, selectors, options) {
  const doc = root?.ownerDocument || root;
  for (const selector of selectors) {
    const found = [...root.querySelectorAll(selector)].find(node => renderedRoot(node, doc, options));
    if (found) return found;
  }
  return null;
}

export function safeUrl(raw, base) {
  if (!raw) return '';
  try { const url = new URL(raw, base); return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
}
