import { useState } from 'react';
import { Globe } from '@taurent/shared';
import type { SidebarTrackerEntry } from '@taurent/web-core/screens';
import { getCapabilityStatus, type AppCapabilities } from '@taurent/web-core/capabilities';
import { SidebarFilterItem } from '@taurent/web-ui';
import { SidebarSection } from './SidebarSection';
import { TrackerContextMenu } from '../../components/ContextMenu';
import type { useSidebarActions } from './useSidebarActions';

interface TrackersSectionProps {
  items: SidebarTrackerEntry[];
  activeTracker: string | null;
  onTrackerClick: (tracker: string | null) => void;
  sidebarActions: ReturnType<typeof useSidebarActions>;
  /** Total torrents matching all filters except the tracker dimension. Used for "All Trackers" row. */
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

export function TrackersSection({
  items,
  activeTracker,
  onTrackerClick,
  sidebarActions,
  totalFilteredCount,
  capabilities,
}: TrackersSectionProps) {
  const capStatus = getCapabilityStatus(capabilities, 'supportsTrackerEditing');
  const capTooltip = buildCapabilityTooltip(capStatus);

  const [expanded, setExpanded] = useState(true);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    trackerUrl: string;
    hostname: string;
  } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, trackerUrl: string, hostname: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, trackerUrl, hostname });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  return (
    <>
      <SidebarSection
        title="Trackers"
        expanded={expanded}
        onToggle={() => setExpanded((current) => !current)}
        disabled={!capStatus.enabled}
        disabledTitle={capTooltip}
      >
        <SidebarFilterItem
          icon={<Globe />}
          label="All Trackers"
          count={totalFilteredCount}
          active={activeTracker === null}
          onClick={() => onTrackerClick(null)}
          ariaPressed={activeTracker === null}
        />
        {items.length > 0 ? (
          items.map(({ trackerUrl, hostname, count }) => {
            const isActive = activeTracker === trackerUrl;

            return (
              <SidebarFilterItem
                key={trackerUrl}
                icon={<Globe />}
                label={hostname}
                count={count}
                active={isActive}
                onClick={() => onTrackerClick(isActive ? null : trackerUrl)}
                onContextMenu={(e) => handleContextMenu(e, trackerUrl, hostname)}
                title={trackerUrl}
              />
            );
          })
        ) : (
          <p className="px-2 py-1 text-xs text-text-muted">No trackers available</p>
        )}
      </SidebarSection>

      {contextMenu && (() => {
        const hashes = sidebarActions.getHashesByTracker(contextMenu.trackerUrl);
        return (
          <TrackerContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            hostname={contextMenu.hostname}
            hashes={hashes}
            onClose={handleCloseContextMenu}
            onRemoveTracker={() => {
              void sidebarActions.removeTrackerFromTorrents(contextMenu.trackerUrl, hashes);
            }}
            onResumeTorrents={sidebarActions.resumeTorrents}
            onPauseTorrents={sidebarActions.pauseTorrents}
            onRemoveTorrents={sidebarActions.removeTorrents}
          />
        );
      })()}
    </>
  );
}
