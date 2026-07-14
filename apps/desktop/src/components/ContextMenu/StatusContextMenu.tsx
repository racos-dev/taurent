import { ContextMenu } from '@taurent/web-ui';
import type { ContextMenuItem as TContextMenuItem } from '@taurent/web-ui';
import { TorrentBulkMenuItems } from './TorrentBulkMenuItems';
import { useQBClient } from '@/connection/useQBClientHooks';

interface StatusContextMenuProps {
  x: number;
  y: number;
  label: string;
  hashes: string[];
  onClose: () => void;
  onResumeTorrents: (hashes: string[]) => void;
  onPauseTorrents: (hashes: string[]) => void;
  onRemoveTorrents: (hashes: string[]) => void;
}

export function StatusContextMenu({
  x,
  y,
  label,
  hashes,
  onClose,
  onResumeTorrents,
  onPauseTorrents,
  onRemoveTorrents,
}: StatusContextMenuProps) {
  const { capabilities } = useQBClient();
  const items: TContextMenuItem[] = [
    { kind: 'separator', id: 'sep-header', label },
    ...(hashes.length > 0
      ? TorrentBulkMenuItems({
          hashes,
          onResume: onResumeTorrents,
          onPause: onPauseTorrents,
          onRemove: onRemoveTorrents,
          onClose,
          supportsPauseResume: capabilities.supportsPauseResume,
        })
      : []),
  ];

  return <ContextMenu x={x} y={y} onClose={onClose} items={items} width="w-56" />;
}
