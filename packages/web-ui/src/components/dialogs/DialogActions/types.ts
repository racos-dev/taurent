import type { ReactNode } from 'react';
import type { ButtonSize, ButtonVariant } from '../../primitives/Button';

export interface DialogAction {
  label: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

export interface DialogActionsProps {
  actions: DialogAction[];
  layout?: 'row' | 'stack';
  size?: ButtonSize;
  stretch?: boolean;
  className?: string;
  actionClassName?: string;
}
