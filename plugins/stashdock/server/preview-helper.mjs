// One child lifetime owns its admission slot, output bound and cancellation.
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function createPreviewHelperRunner({ launch = spawn, maximum = 4 } = {}) {
  let active = 0;
  return (helper, job, signal, { maxOutput = 1_000_000, timeout = 55_000, args = [] } = {}) => {
    if (signal?.aborted) return Promise.reject(Error('Screenshot cancelled'));
    if (active >= maximum) return Promise.reject(Error('The renderer is busy. Retry in a moment.'));
    active++;
    return new Promise((resolve, reject) => {
      let child, profileRoot;
      const cleanup = () => profileRoot ? rm(profileRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) : Promise.resolve();
      try {
        // Parent-owned scratch directory also survives forced-child cancellation
        // long enough for the parent to remove it after the renderer job exits.
        if (!job.browserOperation && !job.imageOperation && !job.integrationOperation) profileRoot = mkdtempSync(join(tmpdir(), 'stashdock-capture-owner-'));
        child = launch(helper, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'],
          env: { ...process.env, ...(profileRoot ? { STASHDOCK_CAPTURE_PROFILE_ROOT: profileRoot } : {}) } });
      }
      catch (error) { cleanup().catch(() => {}).finally(() => { active--; reject(error); }); return; }
      const decoder = new StringDecoder('utf8');
      let output = '', reason, bytes = 0;
      const kill = error => { reason ||= error; child.kill(); };
      const cancel = () => kill(Error('Screenshot cancelled'));
      const timer = setTimeout(() => kill(Error('Screenshot timed out')), timeout);
      signal?.addEventListener('abort', cancel, { once: true });
      child.stdout.on('data', chunk => {
        if (reason) return;
        bytes += chunk.length;
        if (bytes > maxOutput) { output = ''; kill(Error('Renderer result is too large')); }
        else output += decoder.write(chunk);
      });
      child.on('error', error => { reason ||= error; });
      child.stdin.on('error', error => { reason ||= error; });
      child.once('close', async code => {
        clearTimeout(timer); signal?.removeEventListener('abort', cancel);
        try { await cleanup(); } catch { reason ||= Error('The renderer temporary files could not be removed.'); }
        active--;
        if (reason || code !== 0) { reject(reason || Error('Screenshot renderer stopped')); return; }
        try { resolve(JSON.parse(output + decoder.end())); } catch { reject(Error('Invalid screenshot result')); }
      });
      if (signal?.aborted) cancel();
      try { child.stdin.end(JSON.stringify(job.browserOperation || job.imageOperation || job.integrationOperation ? job : { url: job.url, needPreview: !job.lookup && job.needsPreview !== false, ...(job.lookup ? { lookup: true } : {}), ...(job.contentOnly ? { contentOnly: true } : {}), ...(job.faviconUrl ? { faviconUrl: job.faviconUrl } : {}) })); }
      catch (error) { kill(error); }
    });
  };
}
export const runPreviewHelper = createPreviewHelperRunner();
