async page => {
  // Isolated development harness only, never the real host composer.
  await page.goto('http://127.0.0.1:18747/?locale=en-US');
  const imported = await page.evaluate(async () => {
    const response = await fetch('/tool', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      name: 'import_stashdock_files', arguments: { files: [{ name: 'original-context.csv', mimeType: 'text/csv',
        base64: btoa('Region,Revenue\nNorth,137\nSouth,249\n'), title: 'Original file acceptance', content: 'Compare the regional totals.' }], tags: ['Acceptance'] },
    }) });
    const value = await response.json(); if (value.isError) throw Error(JSON.stringify(value));
    return value.structuredContent.items[0];
  });
  await page.reload();
  const app = page.frameLocator('iframe');
  const card = app.getByRole('article', { name: 'Original file acceptance', exact: true });
  await card.waitFor(); await card.hover();
  await card.getByRole('button', { name: 'Add Original file acceptance to chat', exact: true }).click();
  await page.getByLabel('Remove test attachment').waitFor();
  const result = await page.evaluate(() => {
    const request = window.testRequests.at(-1);
    return { method: request.method, meta: request.params._meta, text: request.params.content[0].text };
  });
  if (result.meta['openai/message'].send !== false) throw Error('Unexpected automatic send');
  for (const required of ['get_stashdock_file', imported.id, 'Compare the regional totals.', 'not the file contents']) {
    if (!result.text.includes(required)) throw Error('Missing file requirement: ' + required);
  }
  if (await page.getByLabel('Test draft').inputValue() !== 'Keep this draft unchanged.') throw Error('Draft was changed');
  await page.screenshot({ path: 'output/playwright/original-file-context.png' });
  // No advertised draft capability must stay a usable library, not send a message.
  await page.goto('http://127.0.0.1:18747/?locale=en-US&draft=0');
  const readOnlyCard = app.getByRole('article', { name: 'Original file acceptance', exact: true });
  await readOnlyCard.waitFor(); await readOnlyCard.hover();
  if (!await readOnlyCard.getByRole('button', { name: 'Add Original file acceptance to chat', exact: true }).isDisabled()) throw Error('Unavailable draft action enabled');
  return { originalReadingRequirements: true, supplementalContextPreserved: true, send: false, hostCapabilityGate: true, actualHostComposerVerified: false };
}
