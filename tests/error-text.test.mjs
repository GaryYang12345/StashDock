import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { zh } from '../src/features/settings/messages.mjs';

const bundle = await build({ stdin: { contents: "export * from './src/lib/errorText';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node' });
const module = { exports: {} };
new Function('module', 'exports', bundle.outputFiles[0].text)(module, module.exports);
const { errorText, COMPOSER_UNAVAILABLE } = module.exports;
class McpError extends Error { constructor(code, text) { super(`MCP error ${code}: ${text}`); this.name = 'McpError'; } }

test('people never see protocol codes or error wrappers', () => {
  // The ChatGPT host refusing a draft when no conversation input is available.
  assert.equal(errorText(new McpError(-32000, 'The composer is unavailable')), COMPOSER_UNAVAILABLE);
  assert.equal(errorText(new McpError(-32001, 'Request timed out')), 'The request took too long. Try again.');
  assert.equal(errorText(new McpError(-32000, 'Connection closed')), 'The connection to StashDock was lost. Retry the connection.');
  assert.equal(errorText(new McpError(-32602, 'Invalid params: ids')), 'The request could not be completed. Try again.');
  // StashDock's own messages pass through, ready for the catalog.
  assert.equal(errorText(new Error('Choose an empty folder so existing files are not overwritten.')), 'Choose an empty folder so existing files are not overwritten.');
  assert.equal(errorText('Error: Settings could not be loaded. Retry.'), 'Settings could not be loaded. Retry.');
  assert.equal(errorText('This shortcut is in use by another app. Choose another shortcut.'), 'This shortcut is in use by another app. Choose another shortcut.');
  assert.equal(errorText(undefined), 'The request failed. Please retry.');
  for (const text of [COMPOSER_UNAVAILABLE, 'The request took too long. Try again.', 'The connection to StashDock was lost. Retry the connection.', 'The request could not be completed. Try again.', 'The request failed. Please retry.'])
    assert.ok(zh[text], text);
});
