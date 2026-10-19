import type { StashItem } from '../types';

export type FileReferencePayload = { name: string; mimeType: string; base64: string; title: string; content: string; preview?: string };
export const FILE_REFERENCE_LIMIT = 5_000_000;
export function fileReferenceType(item: Pick<StashItem, 'kind' | 'title' | 'mimeType' | 'origin' | 'assetPath'>) {
  const name = item.origin?.fileName || item.assetPath || item.title;
  const extension = name.split('.').pop()?.toLowerCase() || '';
  const mime = item.mimeType || '';
  if (item.kind === 'image' || mime.startsWith('image/') || /^(png|jpe?g|gif|webp|svg|avif|heic)$/.test(extension)) return { label: 'Image', visual: 'image' as const };
  if (item.kind === 'pdf' || extension === 'pdf') return { label: 'PDF', visual: 'pdf' as const };
  if (/^(docx?|odt|rtf)$/.test(extension) || mime.includes('word')) return { label: 'Document', visual: 'document' as const };
  if (/^(xlsx?|csv|ods)$/.test(extension) || mime.includes('spreadsheet')) return { label: 'Spreadsheet', visual: 'spreadsheet' as const };
  if (/^(pptx?|odp)$/.test(extension) || /presentation|powerpoint/.test(mime)) return { label: 'Presentation', visual: 'presentation' as const };
  if (/^(zip|rar|7z|gz|tar)$/.test(extension)) return { label: 'Archive', visual: 'archive' as const };
  if (/^(mp4|mov|webm|avi)$/.test(extension) || mime.startsWith('video/')) return { label: 'Video', visual: 'video' as const };
  if (/^(mp3|wav|m4a|ogg|flac)$/.test(extension) || mime.startsWith('audio/')) return { label: 'Audio', visual: 'audio' as const };
  if (/^(json|xml|yaml|yml|toml)$/.test(extension) || /json|xml|yaml|toml/.test(mime)) return { label: 'Structured data', visual: 'data' as const };
  if (/^(md|mdx)$/.test(extension) || mime === 'text/markdown') return { label: 'Markdown', visual: 'markdown' as const };
  if (/^(js|jsx|ts|tsx|rs|py|go|java|html|css|sql|c|cpp|h|swift|rb|sh)$/.test(extension)) return { label: 'Code', visual: 'code' as const };
  if (/^(txt|log)$/.test(extension) || mime.startsWith('text/')) return { label: 'Text file', visual: 'text' as const };
  return { label: 'File', visual: 'file' as const };
}
export function isFileReference(item: Pick<StashItem, 'kind'>) { return ['file', 'pdf', 'image'].includes(item.kind); }
export async function stageFileContent(file: File) {
  if (file.size > FILE_REFERENCE_LIMIT) throw Error('Choose a file under 5 MB.');
  return file.type.startsWith('text/') || /\.(txt|md|mdx|csv|log|json|html|css|js|jsx|ts|tsx|py|rs|yaml|yml|toml|xml|sql)$/i.test(file.name)
    ? (await file.text()).slice(0, 50_000) : '';
}
export async function fileReferencePayload(file: File, title: string, content: string): Promise<FileReferencePayload> {
  if (file.size > FILE_REFERENCE_LIMIT) throw Error('Choose a file under 5 MB.');
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(Error('The file could not be read. Choose it again.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(file);
  });
  return { name: file.name, mimeType: file.type, base64, title: title.trim() || file.name, content };
}
