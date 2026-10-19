async page => {
  // Synthetic DOM acceptance in an owned browser. No sign-in, user tabs,
  // cookies, external requests or real-library writes.
  const cases = [
    ['X', 'https://x.com/mira/status/123', '<article data-testid="tweet"><div data-testid="User-Name">Mira</div><a href="/mira/status/123"><time>Today</time></a><div data-testid="tweetText">Actual post</div></article>'],
    ['Instagram', 'https://www.instagram.com/p/Post_123/', '<div role="dialog"><article><a href="/p/Post_123/">Post</a><h1>Actual post</h1><div data-testid="comments">Comment secret</div></article></div>'],
    ['Reddit', 'https://www.reddit.com/r/test/comments/abc123/post/', '<shreddit-post id="t3_abc123" post-title="Actual title"><div slot="text-body">Actual post</div><shreddit-comment>Comment secret</shreddit-comment></shreddit-post>'],
    ['LinkedIn', 'https://www.linkedin.com/feed/update/urn:li:activity:123456/', '<div data-urn="urn:li:activity:123456"><div class="update-components-text">Actual post</div><div class="comments-comment-item">Comment secret</div></div>'],
    ['Pinterest', 'https://www.pinterest.com/pin/123456789/', '<div data-test-id="pin-closeup" data-pin-id="123456789"><h1>Actual title</h1><div data-test-id="pin-description">Actual post</div><div data-test-id="comments">Comment secret</div></div>'],
    ['Xiaohongshu', 'https://www.xiaohongshu.com/explore/123', '<div class="note-detail-mask"><div class="note-content"><h1 id="detail-title">Actual title</h1><div id="detail-desc">Actual post</div></div><div class="comments">Comment secret</div></div>'],
    ['Zhihu', 'https://zhuanlan.zhihu.com/p/123', '<h1 class="Post-Title">Actual title</h1><div class="Post-RichTextContainer">Actual post</div><aside>Comment secret</aside>'],
  ];
  await page.goto('about:blank');
  await page.route('**/*', route => route.abort());
  const reports = [];
  try {
    for (const [platform, url, html] of cases) {
      await page.route(url, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><title>Fixture</title>${html}` }));
      await page.goto(url);
      await page.addScriptTag({ path: 'extension/ui/page-capture.js' });
      const result = await page.evaluate(() => window.StashDockPageCapture.capturePage(document, location.href, { allowSelection: false }));
      if (result.platform !== platform || !result.content.includes('Actual post') || /Comment secret/.test(result.content)) throw Error(`Platform fixture failed: ${platform}`);
      reports.push({ platform, currentPostOnly: true, commentsExcluded: true });
    }
    return { syntheticPages: true, realSignedInAcceptance: false, reports };
  } finally {
    await page.unrouteAll();
    await page.goto('about:blank');
  }
}
