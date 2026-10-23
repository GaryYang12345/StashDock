import chrome from '../../assets/brands/chrome.svg?inline';
import edge from '../../assets/brands/edge.svg?inline';
import firefox from '../../assets/brands/firefox.svg?inline';
import safari from '../../assets/brands/safari.svg?inline';
import codex from '../../assets/brands/chatgpt.svg?inline';
import claude from '../../assets/brands/claude.svg?inline';
// The app's own launch tile (white plate), like the other apps' brand icons.
import desktop from '../../../src-tauri/icons/128x128.png';
import type { IntegrationId } from './integrations';
import styles from './IntegrationSections.module.css';
const marks = { chrome, edge, firefox, safari, codex, claude, desktop };
export function IntegrationIcon({ id }: { id: IntegrationId }) {
  return <img src={marks[id]} className={styles.icon} data-integration-icon={id} alt="" width={24} height={24} aria-hidden="true" />;
}
