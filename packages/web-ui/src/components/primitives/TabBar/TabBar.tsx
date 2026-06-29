import React from 'react';
import { cn } from '@taurent/shared';
import type { TabBarProps } from './types';
import {
  useControlDensity,
  TAB_BAR_PILL_ITEM_CLASSES,
  TAB_BAR_UNDERLINE_ITEM_CLASSES,
} from '../../../controlSizing';

const gridColsMap: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};

export const TabBar = React.memo<TabBarProps>(
  ({ tabs, activeTab, onTabChange, variant, className }) => {
    const density = useControlDensity();
    const pillItemClasses = TAB_BAR_PILL_ITEM_CLASSES[density];
    const underlineItemClasses = TAB_BAR_UNDERLINE_ITEM_CLASSES[density];
    return (
      <div role="tablist" className={className}>
        {variant === 'underline' ? (
          <div className="flex border-b border-border">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  underlineItemClasses,
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-sm border border-border bg-surface p-1">
            <div
              className={cn('grid', gridColsMap[tabs.length])}
              style={
                !gridColsMap[tabs.length]
                  ? { gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }
                  : undefined
              }
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    pillItemClasses,
                    activeTab === tab.id
                      ? 'bg-primary text-text-on-primary'
                      : 'text-text-secondary hover:bg-surface-interactive',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  },
);

TabBar.displayName = 'TabBar';
