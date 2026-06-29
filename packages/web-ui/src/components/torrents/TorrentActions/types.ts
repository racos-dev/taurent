import type { AppIconName } from '@taurent/shared';
import type { ReactNode } from 'react';

export interface ActionButtonProps {
  icon: AppIconName;
  label: string;
  tone?: 'primary' | 'secondary' | 'danger';
  onClick: () => void;
  disabled?: boolean;
}

export interface ActionChipProps {
  icon: AppIconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  isActive?: boolean;
}

export interface TorrentActionsBarProps {
  /** Primary action buttons (e.g. Pause/Resume + Delete) rendered in a grid */
  primaryActions: ReactNode;
  /** Scrollable secondary action chips */
  secondaryActions: ReactNode;
}
