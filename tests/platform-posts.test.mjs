import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { capturePage } from '../extension/page-capture.js';

const documentFor = (html, url) => new JSDOM(`<html><head><title>Page</title></head><body>${html}</body></html>`, { url }).window.document;
const capture = (html, url) => capturePage(documentFor(html, url), url, { allowSelection: false });
const fixtures = [
  { name: 'Instagram', url: 'https://www.instagram.com/p/Post_123/', feed: 'https://www.instagram.com/', id: 'Post_123',
    html: '<article><a href="/p/Other/">Other post</a><h1>Unrelated feed secret</h1></article><div role="dialog"><article><a href="/p/Post_123/"><time datetime="2026-10-15">Today</time></a><header><a href="/mira/">Mira</a><img alt="Profile avatar"></header><h1>Actual caption<br>Second line<span hidden>Hidden secret</span></h1><img alt="A seaside scene"><button data-testid="caption-more">more</button><div data-testid="comments">Comment secret<img alt="Comment GIF"></div><form><textarea>Private draft</textarea></form></article></div>',
    content: /Actual caption\nSecond line/, author: 'Mira' },
  { name: 'Reddit', url: 'https://www.reddit.com/r/test/comments/abc123/post/', feed: 'https://www.reddit.com/r/test/', id: 'abc123',
    html: '<shreddit-post id="t3_other" post-title="Unrelated feed secret"></shreddit-post><shreddit-post id="t3_abc123" post-title="Actual title" author="mira"><div slot="text-body"><p>Actual body</p><span hidden>Hidden secret</span></div><shreddit-comment>Comment secret</shreddit-comment><button data-testid="show-more">more</button></shreddit-post>',
    content: /Actual title\n\nActual body/, author: 'mira' },
  { name: 'LinkedIn', url: 'https://www.linkedin.com/feed/update/urn:li:activity:123456/', feed: 'https://www.linkedin.com/feed/', id: '123456',
    html: '<div data-urn="urn:li:activity:999"><div class="update-components-text">Unrelated feed secret</div></div><div data-urn="urn:li:activity:123456"><div class="update-components-actor__title">Mira</div><div class="update-components-text">Actual post<br>Second line<div class="comments-comment-item">Comment secret</div><span hidden>Hidden secret</span></div><button class="feed-shared-inline-show-more-text__see-more-less-toggle">more</button><form><textarea>Private draft</textarea></form></div>',
    content: /Actual post\nSecond line/, author: 'Mira' },
  { name: 'Pinterest', url: 'https://www.pinterest.com/pin/123456789/', feed: 'https://www.pinterest.com/', id: '123456789',
    html: '<div data-test-id="pin-closeup" data-pin-id="123456789"><h1 data-test-id="pin-title">Actual title</h1><div data-test-id="pin-description">Actual description<span hidden>Hidden secret</span></div><div data-test-id="creator-profile-name">Mira</div><div data-test-id="pin-closeup-image"><img alt="Actual image description"></div><button data-test-id="description-more">more</button><div data-test-id="comments">Comment secret</div><div data-test-id="related-pins">Unrelated feed secret</div></div>',
    content: /Actual title\n\nActual description/, author: 'Mira' },
];

for (const fixture of fixtures) {
  test(`${fixture.name} captures only the current post, supports modal content and reports collapse`, () => {
    const item = capture(fixture.html, fixture.url);
    assert.equal(item.platform, fixture.name); assert.equal(item.externalId, fixture.id);
    assert.match(item.content, fixture.content); assert.equal(item.author, fixture.author); assert.equal(item.truncated, true);
    assert.doesNotMatch(item.content, /Unrelated|Comment|Private|Hidden|avatar|more|Today/);
    assert.throws(() => capture(fixture.html, fixture.feed), /individual/);
  });
  test(`${fixture.name} fails closed for login, hidden posts and unrelated generic articles`, () => {
    for (const html of ['<form><input value="private"><textarea>Private draft</textarea></form>', `<div hidden>${fixture.html}</div>`, '<article><h1>Unrelated generic article</h1><p>Not the requested post.</p></article>']) {
      // Instagram's single-article fallback needs an actual caption/media, so
      // use a conflicting permalink rather than an unidentifiable fixture.
      const guarded = fixture.name === 'Instagram' && html.startsWith('<article>') ? html.replace('<article>', '<article><a href="/p/Other/">Other</a>') : html;
      assert.throws(() => capture(guarded, fixture.url), /not loaded|No .* text/);
    }
  });
}

test('Reddit old and legacy layouts retain the post body without comments or voting controls', () => {
  const url = fixtures[1].url;
  for (const html of [
    '<div class="thing" data-fullname="t3_abc123"><a class="title">Old title</a><a class="author">Mira</a><div class="usertext-body">Old body</div><div class="comments">Comment secret</div></div>',
    '<div data-testid="post-container"><a href="/r/test/comments/abc123/post/"><h1>Old title</h1></a><div data-testid="post-content">Old body</div><div data-testid="comment">Comment secret</div></div>',
  ]) {
    const item = capture(html, url); assert.match(item.content, /Old title\n\nOld body/); assert.doesNotMatch(item.content, /Comment/);
  }
});

test('Instagram permalink caption, reel media and conflicting SPA content are handled explicitly', () => {
  assert.match(capture('<article><h1>Single loaded caption</h1></article>', fixtures[0].url).content, /Single loaded caption/);
  assert.equal(capture('<article><img alt="A mountain video"></article>', 'https://www.instagram.com/reel/Reel_456/').externalId, 'Reel_456');
  assert.throws(() => capture('<article><a href="/p/Other/">Other</a><h1>Old content</h1></article>', fixtures[0].url), /not loaded/);
});

test('LinkedIn encoded URNs, public post URLs and articles share the scoped reader', () => {
  for (const url of ['https://www.linkedin.com/feed/update/urn%3Ali%3Aactivity%3A123456/', 'https://www.linkedin.com/posts/mira_actual-activity-123456-abcd/']) {
    assert.equal(capture(fixtures[2].html, url).externalId, '123456');
  }
  const item = capture('<article><h1>Actual article</h1><div class="author-info__name">Mira</div><div class="reader-article-content"><p>Article body</p></div><aside>Comment secret</aside></article>', 'https://www.linkedin.com/pulse/example-mira/');
  assert.equal(item.content, 'Article body'); assert.equal(item.title, 'Actual article'); assert.equal(item.author, 'Mira');
  assert.throws(() => capture('<article><div class="reader-article-content">Wrong page</div></article>', fixtures[2].feed), /individual/);
});

test('Pinterest loading an old pin never falls through to recommendations', () => {
  assert.throws(() => capture(fixtures[3].html.replace('123456789', '987654321'), fixtures[3].url), /not loaded/);
  assert.throws(() => capture('<div data-test-id="closeup-body"><a href="/pin/987654321/">Old pin</a><h1>Old title</h1></div>', fixtures[3].url), /not loaded/);
});

test('new adapters preserve full expanded text, do not mutate DOM and keep the existing length budget', () => {
  for (const fixture of fixtures) {
    const doc = documentFor(fixture.html.replaceAll('>more</button>', ' aria-expanded="true">more</button>'), fixture.url);
    const before = doc.body.innerHTML;
    const item = capturePage(doc, fixture.url);
    assert.equal(item.truncated, false); assert.equal(doc.body.innerHTML, before);
  }
  const item = capture(`<article><h1>${'文'.repeat(22000)}</h1></article>`, fixtures[0].url);
  assert.equal([...item.content].length, 20000); assert.equal(item.truncated, true);
});

test('custom sites use semantic article bodies without hidden state or private drafts', () => {
  for (const selector of ['itemprop="articleBody"', 'class="entry-content"', 'class="post-content"']) {
    const item = capture(`<div ${selector}><p>Actual custom post</p><form><textarea>Private draft</textarea></form><div role="dialog">Hidden login</div></div>`, 'https://custom.example/posts/1');
    assert.match(item.content, /Actual custom post/); assert.doesNotMatch(item.content, /Private draft|Hidden login/);
  }
  assert.equal(capture('<main>Generic page</main>', 'https://instagram.com.example/page').platform, 'instagram.com.example');
});

test('every default platform has a dedicated reader rather than generic-only branding', () => {
  const defaults = readFileSync('src/lib/captureSites.ts', 'utf8').matchAll(/name: '([^']+)'/g);
  const actual = new Set(['X', 'Xiaohongshu', 'Zhihu', ...fixtures.map(fixture => fixture.name)]);
  for (const [, name] of defaults) assert.ok(actual.has(name), `Missing dedicated adapter: ${name}`);
});
