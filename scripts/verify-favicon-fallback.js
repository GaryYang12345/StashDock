// Run through Playwright CLI. Synthetic collection; no real data or external requests.
async page => {
  const context = await page.context().browser().newContext({viewport:{width:1180,height:860}});
  try {
    const app = await context.newPage();
    const requested = [];
    const errors = [];
    app.on('pageerror', error => errors.push(error.message));
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7i8AAAAASUVORK5CYII=','base64');
    await context.route('https://*.fixture.test/**', async route => {
      const url = new URL(route.request().url());
      requested.push(url.hostname + url.pathname);
      if (url.hostname === 'svg.fixture.test' && url.pathname === '/favicon.svg') {
        await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="7" fill="black"/></svg>'});
      } else if ((url.hostname === 'png.fixture.test' && url.pathname === '/favicon.png') ||
                 (url.hostname === 'apple.fixture.test' && url.pathname === '/apple-touch-icon.png') ||
                 (url.hostname === 'saved.fixture.test' && url.pathname === '/known.png')) {
        await route.fulfill({contentType:'image/png',body:png});
      } else await route.fulfill({status:404});
    });
    await context.addInitScript(() => localStorage.setItem('stashdock.items.v1',JSON.stringify(
      ['svg','png','apple','missing','saved'].map(name => ({
        id:name,title:`${name} reference`,kind:'web',source:name,
        url:`https://${name}.fixture.test/page?private=value`,excerpt:'',tags:[],createdAt:'2026-10-01',
        ...(name==='saved'?{origin:{faviconUrl:'https://saved.fixture.test/known.png'}}:{}),
      }))
    )));
    await context.addInitScript(() => {
      window.__faviconErrors = [];
      window.addEventListener('error', event => {
        if (event.target instanceof HTMLImageElement) window.__faviconErrors.push(event.target.src);
      }, true);
    });
    await app.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded',timeout:30000});
    // Select by title rather than depending on the card's internal attributes.
    const card = name => app.locator('article').filter({has:app.getByRole('heading',{name:`${name} reference`,exact:true})});
    for (const name of ['svg','png','apple','saved']) {
      const element = card(name).locator('img[referrerpolicy="no-referrer"][data-loaded]');
      await element.waitFor({timeout:10000});
      if (!(await element.evaluate(el => el.naturalWidth > 0))) throw Error(`${name} icon was not decoded`);
    }
    await app.waitForFunction(() => [...document.querySelectorAll('article')].some(el => el.textContent.includes('missing reference') && !el.querySelector('img[referrerpolicy="no-referrer"]')));
    const expected = {
      svg:['/favicon.ico','/favicon.svg'],
      png:['/favicon.ico','/favicon.svg','/favicon.png'],
      apple:['/favicon.ico','/favicon.svg','/favicon.png','/apple-touch-icon.png'],
      missing:['/favicon.ico','/favicon.svg','/favicon.png','/apple-touch-icon.png'],
      saved:['/known.png'],
    };
    const failed = await app.evaluate(() => window.__faviconErrors);
    for (const [name,paths] of Object.entries(expected)) {
      const actual = requested.filter(url => url.startsWith(`${name}.fixture.test`));
      const expectedFailures = (name === 'missing' ? paths : paths.slice(0,-1))
        .map(path=>`https://${name}.fixture.test${path}`);
      const actualFailures = failed.filter(url => new URL(url).hostname === `${name}.fixture.test`);
      if (JSON.stringify(actualFailures) !== JSON.stringify(expectedFailures)) throw Error(`Wrong fallback order for ${name}: ${actualFailures}`);
      if (actual.some(url => !paths.some(path=>url === `${name}.fixture.test${path}`))) throw Error(`Unexpected request after ${name} succeeded: ${actual}`);
      if (name !== 'missing' && await card(name).locator('img[referrerpolicy="no-referrer"]').getAttribute('src') !== `https://${name}.fixture.test${paths.at(-1)}`) throw Error(`Wrong final icon for ${name}`);
    }
    if(errors.length) throw Error(errors.join('\n'));
    return {svg:true,png:true,apple:true,savedFirst:true,stopsAfterSuccess:true,allFailedFallback:true,requests:requested.length,errors};
  } finally { await context.close(); }
}
