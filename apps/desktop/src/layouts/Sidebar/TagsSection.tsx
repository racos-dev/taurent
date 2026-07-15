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

interface TagsSectionProps {
  items: SidebarTagItem[];
  activeTag: string | null;
  onTagClick: (tag: string | null) => void;
  sidebarActions: ReturnType<typeof useSidebarActions>;
  /** Total torrents matching all filters except the tag dimension. Used for "All Tags" row. */
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

export function TagsSection({
  items,
  activeTag,
  onTagClick,
  sidebarActions,
  totalFilteredCount,
  capabilities,
}: TagsSectionProps) {
  const capStatus = getCapabilityStatus(capabilities, 'supportsTags');
  const capTooltip = buildCapabilityTooltip(capStatus);

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
        title="Tags"
        expanded={expanded}
        onToggle={() => setExpanded((current) => !current)}
        disabled={!capStatus.enabled}
        disabledTitle={capTooltip}
      >
        <SidebarFilterItem
          icon={<Tag />}
          label="All Tags"
          count={totalCount}
          active={activeTag === null}
          onClick={() => onTagClick(null)}
          ariaPressed={activeTag === null}
          title="All Tags"
        />
        {items.length === 0 ? (
          <div className="px-3 py-2 text-sm text-text-muted">No tags</div>
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
          onClick={() => void openCreateDialogWindow({ type: 'tag' })}
          className="w-full flex items-center gap-2 px-2 py-1 cursor-pointer transition-colors text-text-secondary hover:bg-surface-interactive"
        >
          <Plus className="w-3 h-3 flex-shrink-0" />
          <span className="min-w-0 truncate text-xs text-left">Add Tag</span>
          <span className="flex-1" aria-hidden="true" />
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
