// Rendered local form using fixture services. Never writes to the live library.
async page => {
  const reports = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const png = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 400;
    const context = canvas.getContext('2d');
    context.fillStyle = '#d5ddd5'; context.fillRect(0, 0, 640, 400);
    context.fillStyle = '#70857a'; context.fillRect(0, 240, 640, 160);
    context.fillStyle = '#f0e6cd'; context.beginPath(); context.arc(440, 130, 70, 0, Math.PI * 2); context.fill();
    return canvas.toDataURL('image/png').split(',')[1];
  }), 'base64');
  const coverInput = () => page.getByLabel('Choose cover image', { exact: true });
  const pick = async name => {
    await coverInput().setInputFiles({ name, mimeType: 'image/png', buffer: png });
    await page.getByRole('img', { name: 'Selected cover' }).waitFor();
    await page.getByRole('button', { name: 'Replace image', exact: true }).waitFor();
    await page.waitForTimeout(400);
  };
  for (const theme of ['light', 'dark']) for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 780 : 769 });
    await page.emulateMedia({ reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
    await page.goto('http://127.0.0.1:18532/tests/fixtures/desktop-import.html', { waitUntil: 'domcontentloaded' });
    await page.locator('html').evaluate((node, value) => { node.dataset.theme = value; node.dataset.accent = value === 'dark' ? 'blue' : 'neutral'; }, theme);
    await page.getByRole('button', { name: 'Open import fixture', exact: true }).click();
    await page.getByRole('textbox', { name: 'Link', exact: true }).fill('https://example.org/slow');
    await pick('cover.png');
    await page.waitForTimeout(2100);
    if (await page.locator('#saved-items').textContent() !== '[]') throw Error('Choosing a cover persisted the draft');
    await page.getByLabel('Title', { exact: true }).fill('Custom title');
    await page.getByLabel('Content', { exact: true }).fill('Custom context');
    await page.getByRole('tab', { name: 'Note', exact: true }).click();
    if (await page.getByRole('img', { name: 'Selected cover' }).count()) throw Error('Link cover leaked to Note');
    await page.getByRole('tab', { name: 'Link', exact: true }).click();
    await page.getByRole('img', { name: 'Selected cover' }).waitFor();
    if (await page.getByLabel('Title', { exact: true }).inputValue() !== 'Custom title') throw Error('Cover/tab switch lost edits');
    const dialog = page.getByRole('dialog', { name: 'Import references', exact: true });
    await page.waitForTimeout(500);
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Page overflow');
    if (width >= 768 && await dialog.getAttribute('data-scrollable') !== 'false') throw Error('Default import form became scrollable');
    await page.screenshot({ path: `output/playwright/import-cover-${theme}-${width}.png` });
    await page.getByRole('button', { name: 'Restore default cover', exact: true }).click();
    if (await page.getByRole('img', { name: 'Selected cover' }).count()) throw Error('Default cover not restored');
    await pick('replacement.png');
    await coverInput().setInputFiles({ name: 'invalid.png', mimeType: 'image/png', buffer: png });
    await page.getByText('Cover could not be selected', { exact: true }).waitFor();
    if (await page.getByRole('img', { name: 'Selected cover' }).count() !== 1) throw Error('Invalid replacement erased previous cover');
    await page.getByRole('button', { name: 'Save link', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(document.querySelector('#saved-items').textContent).length === 1);
    const saved = JSON.parse(await page.locator('#saved-items').textContent())[0];
    if (saved.title !== 'Custom title' || saved.content !== 'Custom context' || !saved.preview.startsWith('data:image/jpeg;base64,') || saved.origin.previewKind !== 'cover') throw Error('Custom cover did not save with metadata');
    reports.push({ theme, width, persisted: true });
  }
  // Note and multi-file cover ownership, independent per-file metadata.
  await page.goto('http://127.0.0.1:18532/tests/fixtures/desktop-import.html', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open import fixture', exact: true }).click();
  await page.getByRole('tab', { name: 'Note', exact: true }).click();
  await page.getByLabel('Content', { exact: true }).fill('Note with cover'); await pick('note.png');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(document.querySelector('#saved-items').textContent).length === 1);
  if (JSON.parse(await page.locator('#saved-items').textContent())[0].origin.previewKind !== 'cover') throw Error('Note cover lost');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Open import fixture', exact: true }).click();
  await page.getByRole('tab', { name: 'File', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles([
    { name: 'one.txt', mimeType: 'text/plain', buffer: Buffer.from('Original one') },
    { name: 'two.txt', mimeType: 'text/plain', buffer: Buffer.from('Original two') },
  ]);
  await pick('file-cover.png');
  await page.getByRole('button', { name: 'Edit file', exact: true }).click();
  await page.getByRole('menuitem', { name: 'two.txt', exact: true }).click();
  if (await page.getByRole('img', { name: 'Selected cover' }).count()) throw Error('File cover leaked between drafts');
  await page.getByRole('button', { name: 'Save files', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(document.querySelector('#saved-items').textContent).length === 2);
  const files = JSON.parse(await page.locator('#saved-items').textContent());
  if (!files[0].preview || files[1].preview || files[0].content !== 'Original one' || files[1].content !== 'Original two') throw Error('Per-file cover/context mismatch');
  reports.push({ notesAndFiles: 'passed' });
  await page.goto('http://127.0.0.1:18532/tests/fixtures/desktop-import.html?no-cover', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open import fixture', exact: true }).click();
  await page.getByRole('tab', { name: 'Note', exact: true }).click();
  if (await page.getByRole('button', { name: 'Choose image', exact: true }).count()) throw Error('Cover UI appeared in non-local host');
  if (errors.length) throw Error(errors.join('\n'));
  return reports;
}
