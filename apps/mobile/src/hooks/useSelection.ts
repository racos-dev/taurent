import { useState, useCallback } from 'react';

export function useSelection() {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const toggleSelection = useCallback((id: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }

      if (newSet.size > 0 && !selectionMode) {
        setSelectionMode(true);
      } else if (newSet.size === 0) {
        setSelectionMode(false);
      }

      return newSet;
    });
  }, [selectionMode]);

  const startSelection = useCallback((id: string) => {
    setSelectedItems(new Set([id]));
    setSelectionMode(true);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
    setSelectionMode(false);
  }, []);

  const toggleAllSelection = useCallback((allIds: string[]) => {
    if (selectedItems.size === allIds.length) {
      clearSelection();
    } else {
      setSelectedItems(new Set(allIds));
      setSelectionMode(true);
    }
  }, [selectedItems.size, clearSelection]);

  const isSelected = useCallback((id: string) => selectedItems.has(id), [selectedItems]);
  const isAllSelected = useCallback((total: number) => total > 0 && selectedItems.size === total, [selectedItems.size]);

  return {
    selectedItems,
    selectionMode,
    toggleSelection,
    startSelection,
    clearSelection,
    toggleAllSelection,
    isSelected,
    isAllSelected
  };
}