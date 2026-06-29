// Shared filter form state hook — headless, platform-agnostic.
//
// Handles the duplicated category/tag add-form state and mutation wiring
// that was previously duplicated across desktop and mobile filter routes.
//
// Does NOT own confirm logic — that belongs to the routes/components
// depending on platform UX requirements (desktop components confirm internally
// via built-in ConfirmDialog; mobile routes own the in-app confirm flow
// via onLongPressItem + route-local confirmDialog state).
//
// Does NOT import Tauri or router — keep it headless.

import { useState } from 'react';
import type { Category } from '@taurent/shared';

export interface UseFiltersFormStateOptions {
  categories: Record<string, Category> | undefined;
  tags: string[] | undefined;
  createCategory: {
    mutate: (variables: { categoryName: string; savePath?: string }, options?: { onSuccess?: () => void }) => void;
  };
  editCategory?: {
    mutate: (variables: { categoryName: string; savePath: string }, options?: { onSuccess?: () => void }) => void;
  };
  removeCategories: {
    mutate: (categoryNames: string[], options?: { onSuccess?: () => void }) => void;
  };
  createTags: {
    mutate: (tags: string[], options?: { onSuccess?: () => void }) => void;
  };
  deleteTags: {
    mutate: (tags: string[], options?: { onSuccess?: () => void }) => void;
  };
}

export interface UseFiltersFormStateResult {
  // Derived lists
  categoryList: string[];
  categorySavePaths: Record<string, string>;
  tagList: string[];
  // Category form state
  newCategoryName: string;
  setNewCategoryName: (name: string) => void;
  newCategorySavePath: string;
  setNewCategorySavePath: (savePath: string) => void;
  showAddCategory: boolean;
  setShowAddCategory: (show: boolean) => void;
  // Tag form state
  newTagName: string;
  setNewTagName: (name: string) => void;
  showAddTag: boolean;
  setShowAddTag: (show: boolean) => void;
  // Add handlers — reset + close on success
  handleAddCategory: () => void;
  handleEditCategory: (categoryName: string, savePath: string, options?: { onSuccess?: () => void }) => void;
  handleAddTag: () => void;
  // Delete handlers — perform mutation only, no confirm logic
  handleDeleteCategory: (categoryName: string) => void;
  handleDeleteTag: (tagName: string) => void;
}

export function useFiltersFormState({
  categories,
  tags,
  createCategory,
  editCategory,
  removeCategories,
  createTags,
  deleteTags,
}: UseFiltersFormStateOptions): UseFiltersFormStateResult {
  // Category form state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategorySavePath, setNewCategorySavePath] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);

  // Tag form state
  const [newTagName, setNewTagName] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);

  // Derived lists
  const categoryEntries = categories ? Object.entries(categories) : [];
  const categoryList = categoryEntries.map(([name, category]) => category.name || name);
  const categorySavePaths = Object.fromEntries(
    categoryEntries.map(([name, category]) => [category.name || name, category.savePath ?? ''])
  );
  const tagList = tags || [];

  // Add handlers
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    createCategory.mutate(
      { categoryName: newCategoryName.trim(), savePath: newCategorySavePath.trim() },
      {
        onSuccess: () => {
          setNewCategoryName('');
          setNewCategorySavePath('');
          setShowAddCategory(false);
        },
      }
    );
  };

  const handleEditCategory = (
    categoryName: string,
    savePath: string,
    options?: { onSuccess?: () => void },
  ) => {
    editCategory?.mutate({ categoryName, savePath: savePath.trim() }, options);
  };

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    createTags.mutate([newTagName.trim()], {
      onSuccess: () => {
        setNewTagName('');
        setShowAddTag(false);
      },
    });
  };

  // Delete handlers — no confirm logic; components/route own that UX
  const handleDeleteCategory = (categoryName: string) => {
    removeCategories.mutate([categoryName]);
  };

  const handleDeleteTag = (tagName: string) => {
    deleteTags.mutate([tagName]);
  };

  return {
    categoryList,
    categorySavePaths,
    tagList,
    newCategoryName,
    setNewCategoryName,
    newCategorySavePath,
    setNewCategorySavePath,
    showAddCategory,
    setShowAddCategory,
    newTagName,
    setNewTagName,
    showAddTag,
    setShowAddTag,
    handleAddCategory,
    handleEditCategory,
    handleAddTag,
    handleDeleteCategory,
    handleDeleteTag,
  };
}
