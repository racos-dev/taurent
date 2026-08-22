import { useState } from 'react';
import { Tag, Plus } from '@taurent/shared';
import type { SidebarTagItem } from '@taurent/web-core/screens';
import { getCapabilityStatus, type AppCapabilities } from '@taurent/web-core/capabilities';
import { CapabilityButton, SidebarFilterItem } from '@taurent/web-ui';
import { SidebarSection } from './SidebarSection';
import { TagContextMenu } from '../../components/ContextMenu';
import { openCreateDialogWindow } from '../../windows/dialogs/createDialogWindow';
import { openConfirmDialogWindow } from '../../windows/dialogs/confirmDialogWindow';
import type { useSidebarActions } from './useSidebarActions';
import { useTaurentTranslation } from '@taurent/shared/i18n';

interface TagsSectionProps {
  items: SidebarTagItem[];
  activeTag: string | null;
  onTagClick: (tag: string | null) => void;
  sidebarActions: ReturnType<typeof useSidebarActions>;
  /** Total torrents matching all filters except the tag dimension. Used for "All Tags" row. */
  totalFilteredCount: number;
  capabilities: AppCapabilities;
}

export function TagsSection({
  items,
  activeTag,
  onTagClick,
  sidebarActions,
  totalFilteredCount,
  capabilities,
}: TagsSectionProps) {
  const { t } = useTaurentTranslation('torrents');
  const capStatus = getCapabilityStatus(capabilities, 'supportsTags');
  const capTooltip = capStatus.enabled
    ? undefined
    : capStatus.isRemoved && capStatus.removedIn
      ? t('sidebar.removedIn', { version: capStatus.removedIn })
      : capStatus.isUnreleased
        ? t('sidebar.futureRelease')
        : capStatus.requiresVersion
          ? t('sidebar.requiresVersion', { version: capStatus.requiresVersion })
          : undefined;

  const [expanded, setExpanded] = useState(true);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tagName: string;
  } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, tagName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, tagName });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };
  const totalCount = totalFilteredCount;

  return (
    <>
      <SidebarSection
        title={t('sidebar.tags')}
        expanded={expanded}
        onToggle={() => setExpanded((current) => !current)}
        disabled={!capStatus.enabled}
        disabledTitle={capTooltip}
      >
        <SidebarFilterItem
          icon={<Tag />}
          label={t('sidebar.allTags')}
          count={totalCount}
          active={activeTag === null}
          onClick={() => onTagClick(null)}
          ariaPressed={activeTag === null}
          title={t('sidebar.allTags')}
        />
        {items.length === 0 ? (
          <div className="px-3 py-2 text-sm text-text-muted">{t('sidebar.noTags')}</div>
        ) : (
          items.map(({ tag, count }) => (
            <SidebarFilterItem
              key={tag}
              icon={<Tag />}
              label={tag}
              title={tag}
              count={count}
              active={activeTag === tag}
              onClick={() => {
                const newTag = activeTag === tag ? null : tag;
                onTagClick(newTag);
              }}
              onContextMenu={(e) => handleContextMenu(e, tag)}
              ariaPressed={activeTag === tag}
            />
          ))
        )}
        <CapabilityButton
          enabled={capStatus.enabled}
          requiresVersion={capStatus.requiresVersion}
          isRemoved={capStatus.isRemoved}
          removedIn={capStatus.removedIn}
          isUnreleased={capStatus.isUnreleased}
          variant="ghost"
          size="sm"
          onClick={() => void openCreateDialogWindow({ type: 'tag' })}
          className="h-auto w-full justify-start rounded-none px-2 py-1 font-normal text-text-secondary"
        >
          <Plus className="h-3 w-3 shrink-0" />
          <span className="min-w-0 truncate text-left text-xs">{t('sidebar.addTag')}</span>
        </CapabilityButton>
      </SidebarSection>

      {contextMenu && (
        <TagContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tagName={contextMenu.tagName}
          hashes={sidebarActions.getHashesByTag(contextMenu.tagName)}
          onClose={handleCloseContextMenu}
          onDelete={() => {
            void openConfirmDialogWindow({ name: contextMenu.tagName, type: 'tag' });
          }}
          onRemoveUnused={sidebarActions.removeUnusedTags}
          onResumeTorrents={sidebarActions.resumeTorrents}
          onPauseTorrents={sidebarActions.pauseTorrents}
          onRemoveTorrents={sidebarActions.removeTorrents}
        />
      )}
    </>
  );
}
