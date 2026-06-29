export interface FilterTagSectionProps {
  title?: string;
  tags: string[];
  selectedTag: string | null;
  onTagChange?: (tag: string | null) => void;
  onDeleteTag: (tagName: string) => void;
  isLoading: boolean;
  isDeleting: boolean;
  isAdding: boolean;
  onRefresh?: () => void;
  showAddForm: boolean;
  onShowAddForm: (show: boolean) => void;
  newTagName: string;
  onNewTagNameChange: (value: string) => void;
  onSubmitAdd: () => void;
  onCancelAdd: () => void;
  /** 'pill' (desktop) or 'list' (mobile). Defaults to 'pill'. */
  layout?: 'pill' | 'list';
  /** Icon node, used in list layout for each item. */
  icon?: React.ReactNode;
  /** Long-press handler for list layout items (e.g. mobile delete). Pass when the parent manages deletion confirmation. */
  onLongPressItem?: (tag: string) => void;
}
