import github from '../../assets/brands/github.svg?inline';
import styles from './GitHubMark.module.css';

// The unmodified Simple Icons mark used as a mask, so it takes the text color
// of its row or button in both themes.
export function GitHubMark({ size = 24 }: { size?: number }) {
  return <span className={styles.mark} style={{ width: size, height: size, maskImage: `url("${github}")`, WebkitMaskImage: `url("${github}")` }} aria-hidden="true" />;
}
