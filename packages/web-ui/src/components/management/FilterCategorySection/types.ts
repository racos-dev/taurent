export interface FilterCategorySectionProps {
  title?: string;
  categories: string[];
  categorySavePaths?: Record<string, string>;
  selectedCategory: string | null;
  onCategoryChange?: (category: string | null) => void;
  onDeleteCategory: (categoryName: string) => void;
  isLoading: boolean;
  isDeleting: boolean;
  isAdding: boolean;
  isEditing?: boolean;
  onRefresh?: () => void;
  showAddForm: boolean;
  onShowAddForm: (show: boolean) => void;
  newCategoryName: string;
  onNewCategoryNameChange: (value: string) => void;
  newCategorySavePath?: string;
  onNewCategorySavePathChange?: (value: string) => void;
  onSubmitAdd: () => void;
  onCancelAdd: () => void;
  onEditCategory?: (categoryName: string, savePath: string, options?: { onSuccess?: () => void }) => void;
  /** 'pill' (desktop) or 'list' (mobile). Defaults to 'pill'. */
  layout?: 'pill' | 'list';
  /** Shows save-path create/edit controls in list layout. */
  enableSavePathManagement?: boolean;
  /** Icon node, used in list layout for each item. */
  icon?: React.ReactNode;
  /** Long-press handler for list layout items (e.g. mobile delete).
   * When provided, the component does not show its own delete confirmation -
   * the parent is responsible for handling deletion confirmation. */
  onLongPressItem?: (categoryName: string) => void;
}
