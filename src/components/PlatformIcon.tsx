import x from '../assets/brands/x.svg?inline';
import xiaohongshu from '../assets/brands/xiaohongshu.png?inline';
import zhihu from '../assets/brands/zhihu.svg?inline';
import instagram from '../assets/brands/instagram.png?inline';
import pinterest from '../assets/brands/pinterest.png?inline';
import reddit from '../assets/brands/reddit.svg?inline';
import linkedin from '../assets/brands/linkedin.svg?inline';
import type { CaptureSiteId } from '../lib/captureSites';
import styles from './PlatformIcon.module.css';

const marks = { x, xiaohongshu, zhihu, instagram, reddit, linkedin, pinterest };
const brandColors = { x: '#111111', xiaohongshu: '#ff2442', zhihu: '#0084ff', instagram: '#c13584', reddit: '#ff4500', linkedin: '#0a66c2', pinterest: '#e60023' };
// A brand-filled image, rather than CSS overrides inside Arc Avatar.
export function platformAvatar(site: CaptureSiteId) {
  const inset = site === 'xiaohongshu' ? -4 : site === 'zhihu' ? -1 : 7, extent = site === 'xiaohongshu' ? 40 : site === 'zhihu' ? 34 : 18;
  const zhihuSvg = site === 'zhihu' ? decodeURIComponent(marks.zhihu.slice(marks.zhihu.indexOf(',') + 1)).replace('<path', '<rect width="24" height="24" rx="5.72" fill="white"/><path') : '';
  const source = site === 'x' ? marks.x.replaceAll('currentColor', 'white') : site === 'zhihu' ? `data:image/svg+xml,${encodeURIComponent(zhihuSvg)}` : marks[site];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" fill="${brandColors[site]}"/><image href="${source.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}" x="${inset}" y="${inset}" width="${extent}" height="${extent}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
export function platformMark(site: CaptureSiteId) {
  if (['xiaohongshu', 'x', 'instagram', 'pinterest'].includes(site)) return marks[site];
  const svg = decodeURIComponent(marks[site].slice(marks[site].indexOf(',') + 1));
  const original = site === 'zhihu' ? svg.replace('<path', '<rect width="24" height="24" rx="5.72" fill="white"/><path') : svg.replace(/fill=(['"])(?:#fff(?:fff)?|white)\1/gi, `fill="${brandColors[site]}"`);
  return `data:image/svg+xml,${encodeURIComponent(original)}`;
}
export function PlatformIcon({ site }: { site: CaptureSiteId }) {
  return <img className={styles.icon} data-platform={site} src={platformMark(site)} alt="" aria-hidden="true" width={20} height={20} />;
}
