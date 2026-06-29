import { Trash2, Eraser } from '@taurent/shared';
import { ContextMenu } from '@taurent/web-ui';
import type { ContextMenuItem as TContextMenuItem } from '@taurent/web-ui';
import { TorrentBulkMenuItems } from './TorrentBulkMenuItems';

interface TagContextMenuProps {
  x: number;
  y: number;
  tagName: string;
  hashes: string[];
  onClose: () => void;
  onDelete: () => void;
  onRemoveUnused: () => void;
  onResumeTorrents: (hashes: string[]) => void;
  onPauseTorrents: (hashes: string[]) => void;
  onRemoveTorrents: (hashes: string[]) => void;
}

export function TagContextMenu({
  x,
  y,
  tagName,
  hashes,
  onClose,
  onDelete,
  onRemoveUnused,
  onResumeTorrents,
  onPauseTorrents,
  onRemoveTorrents,
}: TagContextMenuProps) {
  const items: TContextMenuItem[] = [
    { kind: 'separator', id: 'sep-header', label: tagName },
    { kind: 'item', id: 'remove-tag', label: 'Remove tag', icon: Trash2, onClick: () => { onClose(); onDelete(); }, destructive: true },
    { kind: 'item', id: 'remove-unused-tags', label: 'Remove unused tags', icon: Eraser, onClick: () => { onClose(); onRemoveUnused(); } },
    ...(hashes.length > 0
      ? (
          [
            { kind: 'separator', id: 'sep-bulk' } as const,
            ...TorrentBulkMenuItems({
              hashes,
              onResume: onResumeTorrents,
              onPause: onPauseTorrents,
              onRemove: onRemoveTorrents,
              onClose,
            }),
          ] as TContextMenuItem[]
        )
      : []),
  ];

  return <ContextMenu x={x} y={y} onClose={onClose} items={items} width="w-56" />;
}
