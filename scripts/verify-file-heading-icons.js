async page => {
  // Isolated fixture or read-only MCP harness. Selection only; never click Save.
  const frame = page.frames().find(candidate => candidate.parentFrame());
  const ui = frame || page;
  await ui.getByRole('button', { name: frame ? 'Import references' : 'Open import fixture', exact: true }).click();
  await ui.getByRole('tab', { name: 'File', exact: true }).click();
  const reports = [];
  for (const [name, mimeType, visual] of [
    ['sample.pdf', 'application/pdf', 'pdf'],
    ['sample.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'document'],
    ['sample.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'spreadsheet'],
    ['sample.png', 'image/png', 'image'],
  ]) {
    await ui.locator('input[type=file]').setInputFiles({ name, mimeType, buffer: Buffer.from('Isolated UI fixture. Original bytes are not parsed.') });
    const glyph = ui.locator('[class*="fileHeading"] [data-visual]');
    await glyph.waitFor();
    if (await glyph.getAttribute('data-visual') !== visual) throw Error(`Wrong file heading glyph: ${name}`);
    const bounds = await glyph.boundingBox();
    if (Math.abs(bounds.width - 20) > 1 || Math.abs(bounds.height - 20) > 1) throw Error('File glyph size changed');
    reports.push({ name, visual, width: bounds.width, height: bounds.height });
    if (visual !== 'image') await ui.getByRole('button', { name: 'Replace files', exact: true }).click();
  }
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await ui.evaluate(({ theme, width }) => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.dataset.accent = width === 390 ? 'blue' : 'neutral';
      }, { theme, width });
      if (await ui.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error(`Horizontal overflow: ${width}/${theme}`);
    }
  }
  await page.screenshot({ path: `output/playwright/file-heading-icons-${frame ? 'mcp' : 'desktop'}-dark-390.png` });
  return { host: frame ? 'MCP harness' : 'Desktop fixture', reports, responsiveWidths: [1440, 1024, 768, 390], themes: ['light', 'dark'], accents: ['neutral', 'blue'], saved: false };
}
