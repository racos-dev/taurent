import { useState } from 'react';
import {
  Filter,
  Download,
  Upload,
  CheckCircle,
  Pause,
  Zap,
  Moon,
  AlertCircle,
} from '@taurent/shared';
import { useTorrentWorkspaceSidebarController } from '@/hooks';
import { FILTER_TYPE_TO_STATUS, type TorrentFilterType } from '@taurent/shared';
import { SidebarFilterItem } from '@taurent/web-ui';

import { CategoriesSection } from './CategoriesSection';
import { SidebarSection } from './SidebarSection';
import { TagsSection } from './TagsSection';
import { TrackersSection } from './TrackersSection';
import { useSidebarActions } from './useSidebarActions';
import { StatusContextMenu } from '../../components/ContextMenu';
import { TORRENT_FILTER_OPTIONS } from '@taurent/shared';

const FILTER_ICONS: Record<TorrentFilterType, React.ComponentType<{ className?: string }>> = {
  all: Filter,
  downloading: Download,
  seeding: Upload,
  completed: CheckCircle,
  stopped: Pause,
  active: Zap,
  inactive: Moon,
  running: Zap,
  stalled: AlertCircle,
  stalled_uploading: Upload,
  stalled_downloading: Download,
  errored: AlertCircle,
};

export function Sidebar() {
  const {
    activeFilters,
    setStatusFilter,
    setCategoryFilter,
    setTagFilter,
    setTrackerFilter,
    statusCounts,
    sidebarCategories,
    sidebarTags,
    sidebarTrackers,
    totalFilteredForCategories,
    totalFilteredForTags,
    totalFilteredForTrackers,
  } = useTorrentWorkspaceSidebarController();

  const sidebarActions = useSidebarActions();

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['status', 'categories', 'tags', 'trackers'])
  );

  const [statusContextMenu, setStatusContextMenu] = useState<{
    x: number;
    y: number;
    label: string;
    filterType: TorrentFilterType;
  } | null>(null);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleStatusContextMenu = (e: React.MouseEvent, label: string, filterType: TorrentFilterType) => {
    e.preventDefault();
    e.stopPropagation();
    setStatusContextMenu({ x: e.clientX, y: e.clientY, label, filterType });
  };

  return (
    <div className="bg-surface border-r border-border flex flex-col h-full">
      <div className="flex-1 overflow-auto py-1">
        <SidebarSection
          title="Status"
          expanded={expandedSections.has('status')}
          onToggle={() => toggleSection('status')}
        >
          {TORRENT_FILTER_OPTIONS.map((option) => {
            const IconComponent = FILTER_ICONS[option.value];
            return (
              <SidebarFilterItem
                key={option.value}
                icon={<IconComponent />}
                label={option.label}
                count={statusCounts[option.value] || 0}
                active={activeFilters.status === FILTER_TYPE_TO_STATUS[option.value]}
                onClick={() => {
                  const newStatus =
                    activeFilters.status === FILTER_TYPE_TO_STATUS[option.value] ? 'all' : FILTER_TYPE_TO_STATUS[option.value];
                  setStatusFilter(newStatus);
                }}
                onContextMenu={(e) => handleStatusContextMenu(e, option.label, option.value)}
              />
            );
          })}
        </SidebarSection>

        <CategoriesSection
          items={sidebarCategories}
          activeCategory={activeFilters.category}
          onCategoryClick={setCategoryFilter}
          expanded={expandedSections.has('categories')}
          onToggle={() => toggleSection('categories')}
          sidebarActions={sidebarActions}
          totalFilteredCount={totalFilteredForCategories}
        />

        <TagsSection
          items={sidebarTags}
          activeTag={activeFilters.tag}
          onTagClick={setTagFilter}
          sidebarActions={sidebarActions}
          totalFilteredCount={totalFilteredForTags}
        />

        <TrackersSection
          items={sidebarTrackers}
          activeTracker={activeFilters.tracker}
          onTrackerClick={setTrackerFilter}
          sidebarActions={sidebarActions}
          totalFilteredCount={totalFilteredForTrackers}
        />
      </div>

      {statusContextMenu && (
        <StatusContextMenu
          x={statusContextMenu.x}
          y={statusContextMenu.y}
          label={statusContextMenu.label}
          hashes={sidebarActions.getHashesByStatus(statusContextMenu.filterType)}
          onClose={() => setStatusContextMenu(null)}
          onResumeTorrents={sidebarActions.resumeTorrents}
          onPauseTorrents={sidebarActions.pauseTorrents}
          onRemoveTorrents={sidebarActions.removeTorrents}
        />
      )}
    </div>
  );
}
