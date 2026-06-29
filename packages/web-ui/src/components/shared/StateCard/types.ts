import type { ReactNode } from 'react';

export interface StateCardProps {
  title: string;
  message?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}
