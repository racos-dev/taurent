import { Play, Square, Trash2 } from '@taurent/shared';
import type { ContextMenuItem as TContextMenuItem } from '@taurent/web-ui';

interface TorrentBulkMenuItemsProps {
  hashes: string[];
  onResume: (hashes: string[]) => void;
  onPause: (hashes: string[]) => void;
  onRemove: (hashes: string[]) => void;
  onClose: () => void;
  supportsPauseResume: boolean;
}

/**
 * Returns bulk torrent action items for use in a context menu items array.
 * Does NOT render JSX — returns plain item descriptors.
 */
export function TorrentBulkMenuItems({
  hashes,
  onResume,
  onPause,
  onRemove,
  onClose,
  supportsPauseResume,
}: TorrentBulkMenuItemsProps): TContextMenuItem[] {
  const disabled = hashes.length === 0;

  return [
    { kind: 'item', id: 'bulk-resume', label: 'Start torrents', icon: Play, disabled: disabled || !supportsPauseResume, onClick: () => { onResume(hashes); onClose(); } },
    { kind: 'item', id: 'bulk-stop', label: 'Stop torrents', icon: Square, disabled, onClick: () => { onPause(hashes); onClose(); } },
    { kind: 'item', id: 'bulk-remove', label: 'Remove torrents', icon: Trash2, disabled, destructive: true, onClick: () => { onRemove(hashes); onClose(); } },
  ];
}
