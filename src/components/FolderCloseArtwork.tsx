import { useId } from 'react';
import { X } from 'lucide-react';

/** Fixed folder material, shared by Windows markup and the native Mac raster. */
export function FolderCloseArtwork({ className }: { className?: string }) {
  const id = 'folderClose' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false" className={className}>
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#FAFAFA" /><stop offset="1" stopColor="#ECECEC" /></linearGradient></defs>
    <circle cx="16" cy="16" r="8.5" fill={`url(#${id})`} stroke="#D7D7D7" />
    <g transform="translate(11 11)"><X size={10} strokeWidth={1.5} stroke="#9C9C9C" data-close-glyph="" /></g>
  </svg>;
}
