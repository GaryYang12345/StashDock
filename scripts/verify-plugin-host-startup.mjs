// Exercise the host's plugin loader, not a manually repaired MCP launch command.
// No model turns, library mutations, or host configuration changes.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const host = spawn(process.argv[2] || 'codex', ['app-server', '--stdio'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
const lines = createInterface({ input: host.stdout });
const pending = new Map();
let nextId = 0, diagnostics = '';
host.stderr.on('data', chunk => { if (diagnostics.length < 8_000) diagnostics += chunk; });
const failPending = error => { for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(error); } pending.clear(); };
host.on('error', failPending);
host.on('exit', code => failPending(new Error(`Verification host exited (${code}).`)));
lines.on('line', line => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  const task = pending.get(message.id);
  if (!task) return;
  pending.delete(message.id); clearTimeout(task.timer);
  if (message.error) task.reject(new Error(JSON.stringify(message.error)));
  else task.resolve(message.result);
});
function request(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out.`)); }, 30_000);
    pending.set(id, { resolve, reject, timer });
    host.stdin.write(JSON.stringify({ id, method, params }) + '\n');
  });
}
try {
  await request('initialize', { clientInfo: { name: 'stashdock-startup-verification', version: '1' }, capabilities: { experimentalApi: true } });
  host.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
  const result = await request('mcpServerStatus/list', { serverName: 'stashdock' });
  const server = result.data.find(server => server.name === 'stashdock');
  assert.ok(server, 'Host did not discover the installed StashDock plugin.');
  assert.equal(server.toolsError, null, server.toolsError || 'Host reported a tool discovery error.');
  assert.equal(server.serverInfo?.name, 'stashdock', 'Host did not initialize the server.');
  const open = Object.values(server.tools).find(tool => tool.name === 'open_stashdock');
  assert.deepEqual(open?._meta?.['openai/ui']?.entrypoints, [{ type: 'global' }, { type: 'thread' }]);
  console.log(JSON.stringify({ hostLoader: true, name: server.name, connected: true, sidebar: true, conversationPanel: true }));
} catch (error) {
  console.error(diagnostics); throw error;
} finally {
  lines.close(); host.stdin.end(); host.kill();
  failPending(new Error('Verification complete.'));
}
