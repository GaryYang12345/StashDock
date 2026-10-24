import apple from '../assets/os/apple.svg?raw';
import windows from '../assets/os/windows.svg?raw';

// Inline so the mark takes the button's text colour.
export function OsMark({ os, size = 16 }: { os: 'windows' | 'mac'; size?: number }) {
  return <span className="os-mark" aria-hidden="true" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: os === 'mac' ? apple : windows }} />;
}
