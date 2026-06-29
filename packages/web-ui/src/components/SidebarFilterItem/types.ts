export interface SidebarFilterItemProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  ariaPressed?: boolean;
  title?: string;
  className?: string;
}