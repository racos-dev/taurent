import React from 'react';
import { Icon } from '@taurent/shared';
import { Input } from '../Input';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
}

const SearchBarComponent: React.FC<SearchBarProps> = React.memo<SearchBarProps>(({
  value,
  onChange,
  onClear,
  placeholder = 'Search',
}) => {
  const handleChange = React.useCallback((newValue: string) => {
    onChange(newValue);
    if (newValue === '') {
      onClear();
    }
  }, [onChange, onClear]);

  return (
    <div className="mt-2">
      <Input
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        icon={<Icon name="search" className="h-4 w-4" />}
        clearable
        autoFocus
        size="sm"
      />
    </div>
  );
});

SearchBarComponent.displayName = 'SearchBar';

export { SearchBarComponent as SearchBar };
