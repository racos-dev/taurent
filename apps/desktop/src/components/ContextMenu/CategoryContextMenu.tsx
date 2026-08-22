import { Pencil, Trash2, Eraser } from '@taurent/shared';
import { ContextMenu } from '@taurent/web-ui';
import type { ContextMenuItem as TContextMenuItem } from '@taurent/web-ui';
import { TorrentBulkMenuItems } from './TorrentBulkMenuItems';
import { useTaurentTranslation } from '@taurent/shared/i18n';

interface CategoryContextMenuProps {
  x: number;
  y: number;
  categoryName: string;
  hashes: string[];
  onClose: () => void;
  canManageCategories: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onRemoveUnused: () => void;
  onResumeTorrents: (hashes: string[]) => void;
  onPauseTorrents: (hashes: string[]) => void;
  onRemoveTorrents: (hashes: string[]) => void;
}

export function CategoryContextMenu({
  x,
  y,
  categoryName,
  hashes,
  onClose,
  canManageCategories,
  onEdit,
  onDelete,
  onRemoveUnused,
  onResumeTorrents,
  onPauseTorrents,
  onRemoveTorrents,
}: CategoryContextMenuProps) {
  const { t } = useTaurentTranslation('torrents');
  const isUncategorized = categoryName === '';

  const items: TContextMenuItem[] = [
    { kind: 'separator', id: 'sep-header', label: categoryName || t('sidebar.uncategorized') },
    { kind: 'item', id: 'edit-category', label: t('sidebar.editCategory'), icon: Pencil, disabled: isUncategorized || !canManageCategories, onClick: () => { onClose(); onEdit(); } },
    { kind: 'item', id: 'remove-category', label: t('sidebar.removeCategory'), icon: Trash2, disabled: isUncategorized || !canManageCategories, onClick: () => { onClose(); onDelete(); }, destructive: true },
    { kind: 'item', id: 'remove-unused-categories', label: t('sidebar.removeUnusedCategories'), icon: Eraser, disabled: !canManageCategories, onClick: () => { onClose(); onRemoveUnused(); } },
    ...(hashes.length > 0
      ? (
          [
            { kind: 'separator' as const, id: 'sep-bulk' } as const,
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
