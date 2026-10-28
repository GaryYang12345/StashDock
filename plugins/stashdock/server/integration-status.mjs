// Current native evidence only. Coalesce concurrent refreshes, never cache a
// completed result: disabling/removing an extension must take effect next time.
import { join } from 'node:path';
import { resolveMacIntegration } from './open-integration.mjs';
import { runPreviewHelper } from './preview-helper.mjs';

export function createIntegrationStatusReader(library, { platform = process.platform, resolveApp = resolveMacIntegration, run = runPreviewHelper } = {}) {
  let flight;
  return () => {
    if (flight) return flight;
    flight = (async () => {
      const info = library.integrations();
      if (platform !== 'darwin') return info;
      let detected = false;
      try {
        const app = await resolveApp('desktop', library.desktopExecutable?.());
        if (app.application && app.safariStatusProbe === true) {
          const state = await run(join(app.application, 'Contents/MacOS/stashdock'), { integrationOperation: 'safari-state' }, undefined,
            { args: ['--safari-extension-state'], maxOutput: 4096, timeout: 5000 });
          detected = state.protocolVersion === 1 && state.enabled === true;
        }
      } catch { /* Missing/old Desktop, timeout or unavailable service: not confirmed. */ }
      return { ...info, items: info.items.map(item => item.id === 'safari' ? { id: 'safari', detected } : item) };
    })().finally(() => { flight = undefined; });
    return flight;
  };
}
