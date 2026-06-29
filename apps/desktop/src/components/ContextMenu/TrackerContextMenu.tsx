import { Trash2 } from '@taurent/shared';
import { ContextMenu } from '@taurent/web-ui';
import type { ContextMenuItem as TContextMenuItem } from '@taurent/web-ui';
import { TorrentBulkMenuItems } from './TorrentBulkMenuItems';

interface TrackerContextMenuProps {
  x: number;
  y: number;
  hostname: string;
  hashes: string[];
  onClose: () => void;
  onRemoveTracker: () => void;
  onResumeTorrents: (hashes: string[]) => void;
  onPauseTorrents: (hashes: string[]) => void;
  onRemoveTorrents: (hashes: string[]) => void;
}

export function TrackerContextMenu({
  x,
  y,
  hostname,
  hashes,
  onClose,
  onRemoveTracker,
  onResumeTorrents,
  onPauseTorrents,
  onRemoveTorrents,
}: TrackerContextMenuProps) {
  const items: TContextMenuItem[] = [
    { kind: 'separator', id: 'sep-header', label: hostname },
    { kind: 'item', id: 'remove-tracker', label: 'Remove tracker', icon: Trash2, onClick: () => { onClose(); onRemoveTracker(); }, destructive: true },
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
