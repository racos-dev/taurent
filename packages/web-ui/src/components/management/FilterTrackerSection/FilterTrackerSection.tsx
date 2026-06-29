import React from 'react';
import { Globe, ICON_SIZES } from '@taurent/shared';
import { FilterListItem } from '../FilterListItem';
import { StateCard } from '../../shared/StateCard';
import type { FilterTrackerSectionProps } from './types';

export const FilterTrackerSection = React.memo<FilterTrackerSectionProps>(({
  trackerEntries,
  selectedTracker,
  onTrackerChange,
  icon,
}) => {
  const renderIcon = (): React.ReactNode => {
    if (icon) return icon;
    return <Globe size={ICON_SIZES.md} />;
  };

  return (
    <div className="flex flex-col gap-1">
      {/* "All Trackers" row */}
      <FilterListItem
        label="All Trackers"
        icon={renderIcon()}
        isSelected={selectedTracker === null}
        onPress={() => onTrackerChange(null)}
      />

      {/* Empty state or tracker list */}
      {trackerEntries.length === 0 ? (
        <StateCard
          title="No trackers yet"
          icon={<Globe size={ICON_SIZES.lg} />}
          className="py-3 px-3"
        />
      ) : (
        trackerEntries.map(({ trackerUrl, hostname, count }) => (
          <FilterListItem
            key={trackerUrl}
            label={hostname}
            icon={renderIcon()}
            isSelected={selectedTracker === trackerUrl}
            isChild={true}
            onPress={() => onTrackerChange(trackerUrl)}
            summary={`${count} torrent${count === 1 ? '' : 's'}`}
          />
        ))
      )}
    </div>
  );
});

FilterTrackerSection.displayName = 'FilterTrackerSection';
