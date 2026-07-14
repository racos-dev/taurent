import { useState } from 'react';
import { Folder, Plus } from '@taurent/shared';
import type { SidebarCategoryItem } from '@taurent/web-core/screens';
import { getCapabilityStatus, type AppCapabilities } from '@taurent/web-core/capabilities';
import { CapabilityButton, SidebarFilterItem } from '@taurent/web-ui';
import { SidebarSection } from './SidebarSection';
import { CategoryContextMenu } from '../../components/ContextMenu';
import { openEditCategoryDialogWindow } from '../../windows/dialogs/editCategoryDialogWindow';
import { openCreateDialogWindow } from '../../windows/dialogs/createDialogWindow';
import { openConfirmDialogWindow } from '../../windows/dialogs/confirmDialogWindow';
import type { useSidebarActions } from './useSidebarActions';

const UNCATEGORIZED_LABEL = 'Uncategorized';

interface CategoriesSectionProps {
  items: SidebarCategoryItem[];
  activeCategory: string | null;
  onCategoryClick: (category: string | null) => void;
  expanded: boolean;
  onToggle: () => void;
  sidebarActions: ReturnType<typeof useSidebarActions>;
  /** Total torrents matching all filters except the category dimension. Used for "All Categories" row. */
  totalFilteredCount: number;
  capabilities: AppCapabilities;
}

function buildCapabilityTooltip(status: ReturnType<typeof getCapabilityStatus>): string | undefined {
  if (status.enabled) return undefined;
  if (status.isRemoved && status.removedIn) return `Removed in qBittorrent ${status.removedIn}+`;
  if (status.isUnreleased) return 'Requires a future qBittorrent release.';
  if (status.requiresVersion) return `Requires qBittorrent ${status.requiresVersion}+`;
  return undefined;
}

export function CategoriesSection({
  items,
  activeCategory,
  onCategoryClick,
  expanded,
  onToggle,
  sidebarActions,
  totalFilteredCount,
  capabilities,
}: CategoriesSectionProps) {
  const capStatus = getCapabilityStatus(capabilities, 'supportsCategoriesManage');
  const capTooltip = buildCapabilityTooltip(capStatus);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    categoryName: string;
    savePath: string;
  } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, categoryName: string) => {
    e.preventDefault();
    e.stopPropagation();
    const item = items.find((i) => i.categoryName === categoryName);
    setContextMenu({ x: e.clientX, y: e.clientY, categoryName, savePath: item?.savePath ?? '' });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const totalCount = totalFilteredCount;

  return (
    <>
      <SidebarSection
        title="Categories"
        expanded={expanded}
        onToggle={onToggle}
        disabled={!capStatus.enabled}
        disabledTitle={capTooltip}
      >
        <SidebarFilterItem
          icon={<Folder />}
          label="All Categories"
          count={totalCount}
          active={activeCategory === null}
          onClick={() => onCategoryClick(null)}
          ariaPressed={activeCategory === null}
          title="All Categories"
        />
        {items.length > 0 ? (
          items.map(({ categoryName, count }) => {
            const label = categoryName || UNCATEGORIZED_LABEL;
            return (
              <SidebarFilterItem
                key={categoryName === '' ? '__uncategorized__' : categoryName}
                icon={<Folder />}
                label={label}
                count={count}
                active={activeCategory === categoryName}
                onClick={() => {
                  const newCategory = activeCategory === categoryName ? null : categoryName;
                  onCategoryClick(newCategory);
                }}
                onContextMenu={(e) => handleContextMenu(e, categoryName)}
                ariaPressed={activeCategory === categoryName}
                title={label}
              />
            );
          })
        ) : (
          <div className="px-3 py-2 text-sm text-text-muted">No categories</div>
        )}
        <CapabilityButton
          enabled={capStatus.enabled}
          requiresVersion={capStatus.requiresVersion}
          isRemoved={capStatus.isRemoved}
          removedIn={capStatus.removedIn}
          isUnreleased={capStatus.isUnreleased}
          onClick={() => void openCreateDialogWindow({ type: 'category' })}
          className="w-full flex items-center gap-2 px-2 py-1 cursor-pointer transition-colors text-text-secondary hover:bg-surface-interactive"
        >
          <Plus className="w-3 h-3 flex-shrink-0" />
          <span className="min-w-0 truncate text-xs text-left">Add Category</span>
          <span className="flex-1" aria-hidden="true" />
        </CapabilityButton>
      </SidebarSection>

      {contextMenu && (
        <CategoryContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          categoryName={contextMenu.categoryName}
          hashes={sidebarActions.getHashesByCategory(contextMenu.categoryName)}
          onClose={handleCloseContextMenu}
          onEdit={() => {
            void openEditCategoryDialogWindow({
              name: contextMenu.categoryName,
              savePath: contextMenu.savePath,
            });
          }}
          onDelete={() => {
            void openConfirmDialogWindow({ name: contextMenu.categoryName, type: 'category' });
          }}
          onRemoveUnused={sidebarActions.removeUnusedCategories}
          onResumeTorrents={sidebarActions.resumeTorrents}
          onPauseTorrents={sidebarActions.pauseTorrents}
          onRemoveTorrents={sidebarActions.removeTorrents}
        />
      )}
    </>
  );
}
