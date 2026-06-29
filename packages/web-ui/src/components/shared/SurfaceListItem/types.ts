import type { ReactNode } from 'react';

export interface SurfaceListItemProps {
  selected?: boolean;
  onClick?: () => void;
  onPress?: () => void;
  children: ReactNode;
  className?: string;
}
