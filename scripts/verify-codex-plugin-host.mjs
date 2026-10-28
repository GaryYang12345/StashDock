// Verify the actual installed plugin through Codex's public app-server protocol.
// Tool inventory only: no thread creation, model calls or library mutations.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
const child = spawn('codex', ['app-server', '--stdio'], { cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'] });
const pending = new Map();
let sequence = 0, stderr = '';
child.stderr.on('data', bytes => { stderr = (stderr + bytes.toString()).slice(-16_000); });
const lines = createInterface({ input: child.stdout });
lines.on('line', line => {
  let value; try { value = JSON.parse(line); } catch { return; }
  const request = pending.get(value.id); if (!request) return;
  pending.delete(value.id); clearTimeout(request.timer);
  if (value.error) request.reject(Error(JSON.stringify(value.error))); else request.resolve(value.result);
});
child.on('error', error => { for (const request of pending.values()) { clearTimeout(request.timer); request.reject(error); } pending.clear(); });
function request(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`Host request timed out: ${method}`)); }, 55_000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
  });
}
try {
  await request('initialize', { clientInfo: { name: 'stashdock-host-verification', version: '1.0.0' }, capabilities: { experimentalApi: true } });
  child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
  const result = await request('mcpServerStatus/list', { serverName: 'stashdock', detail: 'full' });
  const server = result.data.find(value => value.pluginId === 'stashdock@personal' && value.name === 'stashdock');
  assert.ok(server, 'StashDock is missing from the actual host inventory');
  assert.ok(!server.toolsError, server.toolsError);
  for (const name of ['search_stashdock', 'open_stashdock', 'read_stashdock_browser_import']) assert.ok(server.tools[name], `Host did not discover ${name}`);
  console.log(JSON.stringify({ pluginId: server.pluginId, serverName: server.name, tools: Object.keys(server.tools).length, toolsError: server.toolsError, actualCodexLoader: true }, null, 2));
} catch (error) {
  console.error(stderr); throw error;
} finally {
  for (const request of pending.values()) clearTimeout(request.timer);
  child.stdin.end(); child.kill('SIGTERM'); lines.close();
}
