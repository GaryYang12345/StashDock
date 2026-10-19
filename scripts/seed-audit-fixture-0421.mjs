import { createLocalLibrary } from '../plugins/stashdock/server/local-library.mjs';
const dataDir = 'D:/StashDock/artifacts/mcp-test-audit-0421';
const library = createLocalLibrary({dataDir});
try {
  library.importItems(Array.from({length: 65}, (_, i) => ({id: `audit-${i}`, title: `Audit reference ${i}`, kind: 'note', source: 'Personal note', excerpt: 'Fixture only', content: 'Fixture context', tags: ['Research', 'Design', 'Product']})));
} finally { library.close(); }
