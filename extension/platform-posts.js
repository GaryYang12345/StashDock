import { firstVisible, hostIs, normalize, renderedRoot, renderedText, safeUrl } from './capture-dom.js';

// These readers inspect rendered DOM only. A platform URL never falls through
// to Readability: a feed/login/loading page must not become the saved post.
const POST_OPTIONS = { allowDialog: true };
const COMMENTS = 'shreddit-comment, [data-testid="comment"], [data-testid="comments"], .comments, .comments-comments-list, [data-test-id="comments"]';
const text = (root, selectors, exclude = COMMENTS) => renderedText(firstVisible(root, selectors, POST_OPTIONS), root.ownerDocument || root, { ...POST_OPTIONS, exclude });
const shown = node => renderedRoot(node, node.ownerDocument, POST_OPTIONS);
const hasMore = root => [...root.querySelectorAll('[data-testid="show-more"], [data-testid="caption-more"], [data-test-id="description-more"], .feed-shared-inline-show-more-text__see-more-less-toggle, .inline-show-more-text__button')]
  .some(node => {
    // Text readers intentionally omit buttons. Check the disclosure's own CSS
    // separately so a rendered Show more is not mistaken for a hidden control.
    const style = node.ownerDocument.defaultView?.getComputedStyle(node);
    return shown(node.parentElement) && !node.hidden && node.getAttribute('aria-hidden') !== 'true' &&
      style?.display !== 'none' && style?.visibility !== 'hidden' && style?.visibility !== 'collapse' &&
      !node.closest(COMMENTS) && node.getAttribute('aria-expanded') !== 'true';
  });
const published = root => root.querySelector('time[datetime]')?.getAttribute('datetime') || '';
const linkMatches = (link, url, identity) => {
  const href = safeUrl(link.getAttribute('href'), url.href);
  if (!href) return false;
  const parsed = new URL(href);
  return hostIs(parsed.hostname, url.hostname.replace(/^www\./, '')) && identity(parsed) === identity(url);
};

function matchedRoot(doc, url, selectors, identity, attributes = []) {
  const roots = [...doc.querySelectorAll(selectors)].filter(shown);
  const id = identity(url);
  return roots.find(root => attributes.some(name => root.getAttribute(name) === id) ||
    [...root.querySelectorAll('a[href]')].some(link => linkMatches(link, url, identity)));
}

function instagram(doc, url) {
  const identity = value => value.pathname.match(/^\/(?:p|reel|reels|tv)\/([\w-]+)(?:\/|$)/)?.[1];
  const id = identity(url);
  if (!id) throw Error('Open an individual Instagram post or reel, then save it.');
  let root = matchedRoot(doc, url, 'article', identity);
  // A permalink page can omit its own permalink. Accept one article only if it
  // contains no conflicting post link. Never use an arbitrary feed neighbour.
  if (!root) {
    const roots = [...doc.querySelectorAll('article')].filter(shown);
    if (roots.length === 1 && ![...roots[0].querySelectorAll('a[href]')].some(link => {
      const href = safeUrl(link.getAttribute('href'), url.href);
      if (!href) return false;
      const parsed = new URL(href);
      return hostIs(parsed.hostname, 'instagram.com') && identity(parsed) && identity(parsed) !== id;
    })) root = roots[0];
  }
  if (!root) throw Error('This Instagram post is not loaded. Finish signing in or wait for the post, then retry.');
  const content = text(root, ['[data-testid="post-caption"]', '[data-testid="caption"]', 'h1']);
  const media = [...root.querySelectorAll('img[alt]')].filter(shown)
    .filter(image => !image.closest(`${COMMENTS}, header, [data-testid="post-comment-root"]`))
    .map(image => normalize(image.getAttribute('alt'))).filter(alt => alt && !/profile picture|avatar|头像/i.test(alt)).slice(0, 10);
  const body = [content, ...new Set(media.map(alt => `Image: ${alt}`))].filter(Boolean).join('\n\n');
  if (!body) throw Error('No Instagram post text is loaded. Expand the caption or wait for the post, then retry.');
  const author = text(root, ['header a[href]', 'h2 a[href]', '[data-testid="post-author"]']);
  return { platform: 'Instagram', externalId: id, content: body, author, publishedAt: published(root),
    title: `${author || 'Instagram'}: ${content.slice(0, 120) || 'Image post'}`, truncated: hasMore(root) };
}

function reddit(doc, url) {
  const identity = value => value.pathname.match(/\/(?:comments)\/([a-z\d]+)(?:\/|$)/i)?.[1]?.toLowerCase();
  const id = identity(url);
  if (!id) throw Error('Open an individual Reddit post, then save it.');
  const roots = [...doc.querySelectorAll('shreddit-post, .thing[data-fullname], [data-testid="post-container"]')].filter(shown);
  const root = roots.find(node => ['id', 'post-id', 'data-fullname'].some(name => node.getAttribute(name) === `t3_${id}`) ||
    (() => { const href = safeUrl(node.getAttribute('permalink'), url.href); return href && identity(new URL(href)) === id; })()) ||
    matchedRoot(doc, url, '[data-testid="post-container"], .thing[data-fullname]', identity);
  if (!root) throw Error('This Reddit post is not loaded. Finish signing in or wait for the post, then retry.');
  const title = normalize(root.getAttribute('post-title')) || text(root, ['[slot="title"]', '[data-testid="post-title"]', 'a.title', 'h1']);
  const body = text(root, ['[slot="text-body"]', '[data-testid="post-content"]', '.usertext-body', '[slot="post-media-container"]']);
  if (!title && !body) throw Error('No Reddit post text is loaded. Wait for the post, then retry.');
  const author = normalize(root.getAttribute('author')) || text(root, ['[slot="authorName"]', 'a.author', '[data-testid="post_author_link"]']);
  return { platform: 'Reddit', externalId: id, title, content: [...new Set([title, body].filter(Boolean))].join('\n\n'),
    author, publishedAt: published(root), truncated: hasMore(root) };
}

function linkedinIdentity(value) {
  let path; try { path = decodeURIComponent(value.pathname); } catch { return ''; }
  return path.match(/\/feed\/update\/urn:li:(?:activity|share|ugcPost):(\d+)(?:\/|$)/)?.[1] ||
    path.match(/\/posts\/[^/]*activity-(\d+)(?:-|\/|$)/)?.[1] || '';
}

function linkedin(doc, url) {
  if (/^\/pulse\/[^/]+\/?$/.test(url.pathname)) {
    const root = firstVisible(doc, ['article'], POST_OPTIONS);
    const content = root && text(root, ['.reader-article-content', '.article-content', '[data-test-id="article-content"]']);
    if (!content) throw Error('This LinkedIn article is not loaded. Finish signing in or wait for the article, then retry.');
    return { platform: 'LinkedIn', externalId: url.pathname, content, title: text(root, ['h1']),
      author: text(root, ['.author-info__name', '.reader-author-info__author-name']), publishedAt: published(root), truncated: hasMore(root) };
  }
  const id = linkedinIdentity(url);
  if (!id) throw Error('Open an individual LinkedIn post or article, then save it.');
  const selectors = '[data-urn], [data-id], .feed-shared-update-v2, .main-feed-activity';
  const root = [...doc.querySelectorAll(selectors)].filter(shown).find(node => ['data-urn', 'data-id'].some(name =>
      /^(?:urn:li:(?:activity|share|ugcPost):)(\d+)$/.exec(node.getAttribute(name) || '')?.[1] === id)) ||
    matchedRoot(doc, url, '.feed-shared-update-v2, .main-feed-activity', linkedinIdentity);
  if (!root) throw Error('This LinkedIn post is not loaded. Finish signing in or wait for the post, then retry.');
  const content = text(root, ['.update-components-text', '.feed-shared-update-v2__description', '.feed-shared-text', '.attributed-text-segment-list__container'],
    `${COMMENTS}, .comments-comment-item, .feed-shared-update-v2, [data-urn]`);
  if (!content) throw Error('No LinkedIn post text is loaded. Expand the post or wait for it, then retry.');
  const author = text(root, ['.update-components-actor__title', '.feed-shared-actor__name', '.base-main-feed-card__actor-name']);
  return { platform: 'LinkedIn', externalId: id, content, author, publishedAt: published(root),
    title: `${author || 'LinkedIn'}: ${content.slice(0, 120)}`, truncated: hasMore(root) };
}

function pinterest(doc, url) {
  const identity = value => value.pathname.match(/^\/pin\/(\d+)(?:\/|$)/)?.[1];
  const id = identity(url);
  if (!id) throw Error('Open an individual Pinterest pin, then save it.');
  const roots = [...doc.querySelectorAll('[data-test-id="pin-closeup"], [data-test-id="closeup-body"]')].filter(shown);
  const root = matchedRoot(doc, url, '[data-test-id="pin-closeup"], [data-test-id="closeup-body"], [data-test-id="pin"]', identity, ['data-pin-id']) ||
    roots.find(node => !node.hasAttribute('data-pin-id') && !roots.some(other => other !== node && other.contains(node)) &&
      ![...node.querySelectorAll('a[href]')].some(link => {
        if (link.closest('[data-test-id="related-pins"]')) return false;
        const href = safeUrl(link.getAttribute('href'), url.href);
        if (!href) return false;
        const parsed = new URL(href);
        return hostIs(parsed.hostname, 'pinterest.com') && identity(parsed) && identity(parsed) !== id;
      }));
  if (!root) throw Error('This Pinterest pin is not loaded. Finish signing in or wait for the pin, then retry.');
  const title = text(root, ['[data-test-id="pin-title"]', 'h1']);
  const description = text(root, ['[data-test-id="pin-description"]', '[data-test-id="truncated-description"]']);
  const media = firstVisible(root, ['[data-test-id="pin-closeup-image"] img', 'img[data-test-id="pin-closeup-image"]'], POST_OPTIONS);
  const alt = normalize(media?.getAttribute('alt'));
  const content = [...new Set([title, description, alt && `Image: ${alt}`].filter(Boolean))].join('\n\n');
  if (!content) throw Error('No Pinterest pin text is loaded. Wait for the pin, then retry.');
  return { platform: 'Pinterest', externalId: id, title, content,
    author: text(root, ['[data-test-id="creator-profile-name"]', '[data-test-id="pinner-name"]']), truncated: hasMore(root) };
}

const readers = [['instagram.com', instagram], ['reddit.com', reddit], ['linkedin.com', linkedin], ['pinterest.com', pinterest]];
export function additionalPlatformPost(doc, url) {
  const entry = readers.find(([host]) => hostIs(url.hostname, host));
  return entry ? entry[1](doc, url) : null;
}
