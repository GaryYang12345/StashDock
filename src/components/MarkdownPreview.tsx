import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './MarkdownPreview.module.css';

/** Saved Markdown is data: no HTML, executable URLs or automatic image requests. */
export function MarkdownPreview({ content }: { content: string }) {
  return <div className={styles.document}><Markdown skipHtml remarkPlugins={[remarkGfm]}
    urlTransform={url => /^https?:\/\//i.test(url) || url.startsWith('#') ? url : ''}
    components={{
      a: ({ href, children }) => href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
      img: ({ alt }) => <span className={styles.image}>{alt || 'Image'}</span>,
      table: ({ children }) => <div className={styles.table}><table>{children}</table></div>,
    }}>{content}</Markdown></div>;
}
