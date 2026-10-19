import { FileText, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

// Shared product actions: labels, glyphs and stroke weights have one owner.
export function referenceEditActions(onEdit: () => void, onEditContent?: () => void) {
  return [
    { label: 'Edit card', icon: <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />, onSelect: onEdit },
    ...(onEditContent ? [{ label: 'Edit content', icon: <FileText size={16} strokeWidth={1.75} aria-hidden="true" />, onSelect: onEditContent }] : []),
  ];
}

export function tagEditActions(onRename: () => void, onRemove: () => void) {
  return [
    { label: 'Rename tag', icon: <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />, onSelect: onRename },
    { label: 'Remove tag', icon: <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />, destructive: true, onSelect: onRemove },
  ];
}

export function ReferenceMenuIcon() {
  return <MoreHorizontal size={20} strokeWidth={1.75} aria-hidden="true" />;
}
