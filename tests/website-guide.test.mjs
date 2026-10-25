import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const result = await build({ entryPoints: ['website/src/guide/guide-copy.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { guideCopy, guideSections, pluginCommands } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));

test('guide installation command targets the actual packaged plugin and marketplace', async () => {
  const marketplace = JSON.parse(await readFile('.agents/plugins/marketplace.json', 'utf8'));
  const plugin = JSON.parse(await readFile('plugins/stashdock/.codex-plugin/plugin.json', 'utf8'));
  const lines = pluginCommands.split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^codex plugin marketplace add "C:\\StashDock\\plugin"$/);
  assert.equal(lines[1], `codex plugin add ${plugin.name}@${marketplace.name}`);
  assert.ok(marketplace.plugins.some(item => item.name === plugin.name && item.source.path === './plugins/stashdock'));
});

test('guide covers all seven tasks in both languages and states current installation boundaries', () => {
  for (const language of ['en', 'zh']) {
    const text = guideCopy[language];
    assert.deepEqual(Object.keys(text.sections), guideSections);
    assert.equal(text.quick.length, 3);
    assert.equal(text.save.length, 5);
    assert.equal(text.prompts.length, 4);
    for (const browser of ['chrome', 'edge', 'firefox']) assert.equal(text.browserSteps[browser].length, 4);
    assert.match(text.installPrompt, /https:\/\/github.com\/GaryYang12345\/StashDock\/releases\/latest/);
    assert.match(text.pluginSteps.join(' '), /win32-x64\.zip/);
    assert.match(text.pluginNote, /Node\.js/);
    assert.match(text.firefoxNote, language === 'en' ? /temporary.*removed/ : /临时安装.*移除/);
    assert.match(text.desktopMac, language === 'en' ? /coming soon/ : /即将推出/);
    assert.match(text.pluginMac, language === 'en' ? /coming soon/ : /即将推出/);
    assert.match(text.safariNote, /Safari/);
    assert.match(text.browserSteps.firefox.join(' '), /about:debugging#\/runtime\/this-firefox/);
  }
  assert.deepEqual(Object.keys(guideCopy.en), Object.keys(guideCopy.zh));
});
