import type { StashItem } from '../types';
export function buildContext(items: StashItem[], options?: { originalFilesDelivered?: boolean }): string;
export function referenceFileName(item: StashItem): string;
export function contextBody(item: StashItem): { body: string; source: string; label: string };
