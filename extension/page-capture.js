import { Readability } from '@mozilla/readability';
import { EXCLUDE, normalize, hostIs, visible, renderedRoot, renderedText, firstVisible, safeUrl } from './capture-dom.js';
import { additionalPlatformPost } from './platform-posts.js';
export { renderedText } from './capture-dom.js';

const MAX_CONTENT = 20_000;

function metadata(doc, name) {
  return normalize(doc.querySelector(`meta[property="${name}"],meta[name="${name}"]`)?.getAttribute('content'));
}

function xPost(doc, url) {
  const id = url.pathname.match(/^\/(?:[^/]+\/status|i\/web\/status)\/(\d+)(?:\/|$)/)?.[1];
  if (!id) throw Error('Open an individual X post, then save it. Feeds and bookmarks are not imported.');
  const posts = [...doc.querySelectorAll('article[data-testid="tweet"]')].filter(node => renderedRoot(node, doc));
  const post = posts.find(article => [article.querySelector('time')?.closest('a[href]')].filter(Boolean).some(link => {
    const href = safeUrl(link.getAttribute('href'), url.href);
    if (!href) return false;
    const parsed = new URL(href);
    return ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(parsed.hostname)
      && parsed.pathname.match(/^\/[^/]+\/status\/(\d+)\/?$/)?.[1] === id
      && link.closest('article') === article && link.querySelector('time');
  }));
  if (!post) throw Error('This X post is not loaded. Finish signing in or wait for the post, then retry.');
  const text = [...post.querySelectorAll('[data-testid="tweetText"], [data-testid="twitterArticleRichTextView"]')].map(node => renderedText(node, doc)).filter(Boolean);
  const cards = [...post.querySelectorAll('[data-testid="card.wrapper"]')].map(node => renderedText(node, doc)).filter(Boolean);
  const media = [...post.querySelectorAll('[data-testid="tweetPhoto"] img')].map(node => node.getAttribute('alt')).filter(value => value && !/^(image|图片)$/i.test(value));
  const author = renderedText(post.querySelector('[data-testid="User-Name"]'), doc);
  const publishedAt = post.querySelector('time')?.getAttribute('datetime') || '';
  const content = [...new Set([...text, ...cards, ...media.map(alt => `Image: ${alt}`)])].join('\n\n');
  if (!content) throw Error('No post text is available. Add a text selection or save the link manually.');
  const truncated = Boolean(post.querySelector('[data-testid="tweet-text-show-more-link"]'));
  return { platform: 'X', content, author, publishedAt, externalId: id, title: `${author.split('\n')[0] || 'X'}: ${text[0]?.slice(0, 120) || 'Post'}`, truncated };
}

function adaptedPost(doc, url) {
  const host = url.hostname;
  if (hostIs(host, 'x.com') || hostIs(host, 'twitter.com')) return xPost(doc, url);
  const additional = additionalPlatformPost(doc, url);
  if (additional) return additional;
  let platform, selectors, titleSelector, authorSelector;
  if (hostIs(host, 'xiaohongshu.com')) {
    if (!/^\/(?:explore|discovery\/item)\/[^/]+\/?$/.test(url.pathname) && !firstVisible(doc, ['.note-detail-mask', '.note-detail']))
      throw Error('Open an individual Xiaohongshu post, then save it.');
    platform = 'Xiaohongshu'; selectors = ['.note-detail-mask .note-content', '.note-detail .note-content', '#detail-desc', '.note-content'];
    titleSelector = '#detail-title'; authorSelector = '.note-detail-mask .author .username, .note-detail .author .username';
  } else if (hostIs(host, 'zhihu.com')) {
    platform = 'Zhihu'; selectors = ['.Post-RichTextContainer'];
    titleSelector = '.Post-Title, .QuestionHeader-title'; authorSelector = '.AuthorInfo-name';
    const answerId = url.pathname.match(/\/answer\/(\d+)\/?$/)?.[1];
    if (answerId) {
      const answer = [...doc.querySelectorAll('.AnswerItem')].find(node => {
        let extra; try { extra = JSON.parse(node.getAttribute('data-za-extra-module') || '{}'); } catch { extra = {}; }
        return String(extra?.card?.content?.token || '') === answerId || [...node.querySelectorAll('a[href]')].some(link => {
          const href = safeUrl(link.getAttribute('href'), url.href);
          return href && new URL(href).hostname === host && new URL(href).pathname.match(/\/answer\/(\d+)\/?$/)?.[1] === answerId;
        });
      });
      if (!answer) throw Error('This Zhihu answer is not loaded. Select its text or wait for it, then retry.');
      const content = renderedText(answer.querySelector('.RichContent-inner .RichText'), doc);
      if (!content) throw Error('No Zhihu answer text is loaded. Finish signing in, then retry.');
      return { platform, content, title: renderedText(firstVisible(doc, [titleSelector]), doc),
        author: renderedText(answer.querySelector('.AuthorInfo-name'), doc), truncated: Boolean(answer.querySelector('.RichContent-collapsedText')) };
    }
    if (!/^\/p\/\d+\/?$/.test(url.pathname)) throw Error('Open an individual Zhihu article or answer, then save it.');
  } else return null;
  const root = firstVisible(doc, selectors);
  if (!root) throw Error(`Open an individual ${platform} post and wait for its content, then retry.`);
  const content = renderedText(root, doc);
  if (!content) throw Error(`No ${platform} post text is loaded. Finish signing in or select the text to save.`);
  return { platform, content, title: titleSelector ? renderedText(firstVisible(doc, [titleSelector]), doc) : '',
    author: authorSelector ? renderedText(firstVisible(doc, [authorSelector]), doc) : '',
    truncated: Boolean(root.querySelector('[class*="expand"], [class*="show-more"]')) };
}

function article(doc) {
  // Work on a copy. Readability must never edit the user's page.
  if (doc.querySelectorAll('*').length > 20_000) throw Error('This page is very large. Select the text you want to save, then retry.');
  // Suppress CSS-hidden text too; this is not an archive of hidden page state.
  const clean = doc.cloneNode(true);
  const live = [...doc.querySelectorAll('*')], copied = [...clean.querySelectorAll('*')];
  // Use the paired clone for visibility pruning, then strip all private fields.
  live.forEach((node, index) => { if (!visible(node, doc)) copied[index]?.remove(); });
  clean.querySelectorAll(`${EXCLUDE},[role="dialog"]`).forEach(node => node.remove());
  let parsed;
  try { parsed = new Readability(clean, { maxElemsToParse: 20_000, charThreshold: 80, disableJSONLD: true, serializer: node => renderedText(node, clean) }).parse(); }
  catch { /* Small non-article pages use their semantic content region. */ }
  const semantic = firstVisible(doc, ['[itemprop="articleBody"]', '.entry-content', '.post-content', 'article', 'main', '[role="main"]']);
  const content = normalize(parsed?.content) || renderedText(semantic, doc);
  if (!content) throw Error('No readable page content was found. Select the text you want to save, then retry.');
  return { content, title: parsed?.title || '', author: parsed?.byline || '' };
}

export function capturePage(doc, href, { allowSelection = true, metadataOnly = false } = {}) {
  const rawUrl = safeUrl(href, href);
  if (!rawUrl) throw Error('Open an HTTP or HTTPS page to save a reference.');
  const url = new URL(rawUrl);
  // User-selected text takes precedence, but never collect form selections.
  const selection = doc.defaultView?.getSelection();
  const inField = node => (node?.nodeType === 1 ? node : node?.parentElement)?.closest('form,input,textarea,select,[contenteditable]');
  const selected = allowSelection && selection && !inField(selection.anchorNode) && !inField(selection.focusNode) ? normalize(selection.toString()) : '';
  const extracted = metadataOnly ? { content: '', method: 'page' }
    : selected ? { content: selected, method: 'selection' } : { ...(adaptedPost(doc, url) || article(doc)), method: 'page' };
  const truncated = Boolean(extracted.truncated || [...extracted.content].length > MAX_CONTENT);
  const content = [...extracted.content].slice(0, MAX_CONTENT).join('');
  return { url: rawUrl, title: (extracted.title || metadata(doc, 'og:title') || doc.title || url.hostname).slice(0, 300),
    content, description: content.replace(/\s+/g, ' ').slice(0, 180), author: extracted.author || metadata(doc, 'author'),
    publishedAt: extracted.publishedAt || metadata(doc, 'article:published_time'), platform: extracted.platform || url.hostname.replace(/^www\./, ''),
    externalId: extracted.externalId || rawUrl, captureMethod: extracted.method, truncated,
    faviconUrl: safeUrl(doc.querySelector('link[rel~="icon"]')?.getAttribute('href') || '/favicon.ico', rawUrl),
    preview: safeUrl(metadata(doc, 'og:image') || metadata(doc, 'twitter:image'), rawUrl),
    viewport: { width: doc.defaultView?.innerWidth || 0, contentWidth: doc.documentElement.clientWidth || 0 } };
}

export function captureCurrentDocument() {
  try { return { page: capturePage(document, location.href, { allowSelection: false }) }; }
  catch (error) {
    // A reader failure is not a failed bookmark. Keep the current page's identity
    // and an empty body; never substitute unrelated feed, login or private text.
    // The document observer still refreshes this draft when post text arrives.
    try { return { page: capturePage(document, location.href, { allowSelection: false, metadataOnly: true }) }; }
    catch { return { error: error.message || 'Open an HTTP or HTTPS page to save a reference.' }; }
  }
}

export function stopObservingDocument(token) {
  if(token&&globalThis.__stashdockPageWatch?.token!==token)return;
  globalThis.__stashdockPageWatch?.stop();
  delete globalThis.__stashdockPageWatch;
}
export function observeCurrentDocument(token) {
  const chrome = globalThis.browser ?? globalThis.chrome;
  stopObservingDocument();
  let timer, stopped = false, nextInspection = 0;
  const fingerprint = result => JSON.stringify(result.page ? [result.page.url, result.page.title, result.page.content, result.page.truncated] : [result.error]);
  let previous = fingerprint(captureCurrentDocument());
  const inspect = () => {
    timer = undefined;
    if (stopped || document.visibilityState === 'hidden') return;
    nextInspection = Date.now() + 1500;
    const next = fingerprint(captureCurrentDocument());
    if (next === previous) return;
    // Only a notification. The worker validates nonce, sender document and
    // currently active tab before reading again. No page data is messaged.
    const retry=()=>{if(!stopped&&!timer)timer=setTimeout(inspect,1500);};
    try{
      void chrome.runtime.sendMessage({type:'page-content-changed',token}).then(reply=>{if(reply?.received)previous=next;else retry();}).catch(error=>{if(/context invalidated/i.test(error.message))stopObservingDocument(token);else retry();});
    }catch{stopObservingDocument(token);}
  };
  const observer = new MutationObserver(() => {
    if (!timer && !stopped) timer = setTimeout(inspect, Math.max(400, nextInspection - Date.now()));
  });
  const stopMessage=(message,sender,reply)=>{
    if(sender.id!==chrome.runtime.id||message?.type!=='stop-page-watch'||message.token!==token)return;
    stopObservingDocument(token);reply({stopped:true});return false;
  };
  chrome.runtime.onMessage.addListener(stopMessage);
  observer.observe(document.documentElement, {childList:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden','aria-busy'],subtree:true});
  globalThis.__stashdockPageWatch = {token,stop:()=>{stopped=true;clearTimeout(timer);observer.disconnect();chrome.runtime.onMessage.removeListener(stopMessage);}};
  return {observing:true};
}
