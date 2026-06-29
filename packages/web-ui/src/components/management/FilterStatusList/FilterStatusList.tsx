import React from 'react';
import { FilterListItem } from '../FilterListItem';
import type { FilterStatusListProps } from './types';

const ALL_VALUE_DEFAULT = 'all';

export const FilterStatusList = React.memo<FilterStatusListProps>(({
  options,
  selectedValue,
  onSelect,
  allValue = ALL_VALUE_DEFAULT,
}) => {
  return (
    <div className="flex flex-col gap-1">
      {options.map((option) => {
        const isAllValue = option.value === allValue;
        const isSelected = isAllValue
          ? selectedValue === null || selectedValue === allValue
          : selectedValue === option.value;

        return (
          <FilterListItem
            key={option.value}
            label={option.label}
            icon={option.icon}
            isSelected={isSelected}
            onPress={() => onSelect(option.value)}
          />
        );
      })}
    </div>
  );
});

FilterStatusList.displayName = 'FilterStatusList';
