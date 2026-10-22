// Locations of this developer's own installation, resolved the way StashDock
// resolves them, so release scripts carry no personal paths.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { dataDirectory } from '../../plugins/stashdock/server/local-library.mjs';
import { resolveLibraryDirectory } from '../../plugins/stashdock/server/library-location.mjs';

export const repositoryRoot = resolve(import.meta.dirname, '../..');
/** The plugin version has one source: plugins/stashdock/.codex-plugin/plugin.json. */
export const pluginVersion = JSON.parse(readFileSync(join(repositoryRoot, 'plugins/stashdock/.codex-plugin/plugin.json'), 'utf8')).version;
/** The installed Codex plugin copy (override with STASHDOCK_INSTALLED_PLUGIN). */
export const installedPluginFolder = () => resolve(process.env.STASHDOCK_INSTALLED_PLUGIN || join(homedir(), '.codex/plugins/cache/personal/stashdock', pluginVersion));
/** The user's authoritative library folder, following a moved library. */
export const libraryFolder = () => resolveLibraryDirectory(dataDirectory());
