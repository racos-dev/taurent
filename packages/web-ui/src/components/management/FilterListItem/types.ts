export interface FilterListItemProps {
  label: string;
  icon?: React.ReactNode;
  isSelected?: boolean;
  isChild?: boolean;
  summary?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  showCheckmark?: boolean;
}
