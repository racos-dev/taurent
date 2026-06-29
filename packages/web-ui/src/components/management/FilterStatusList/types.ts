export interface FilterStatusListOption {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

export interface FilterStatusListProps {
  options: FilterStatusListOption[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
  allValue?: string;
}
