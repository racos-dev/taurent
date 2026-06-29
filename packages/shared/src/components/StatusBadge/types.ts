export type StatusType =
  | 'downloading'
  | 'seeding'
  | 'paused'
  | 'completed'
  | 'error'
  | 'uploading'
  | 'connected'
  | 'disconnected'
  | 'active'
  | 'inactive'
  | 'checking'
  | 'moving'
  | 'tracker-working'
  | 'tracker-error'
  | 'tracker-disabled'
  | 'tracker-pending'
  | 'tracker-updating';

export type StatusBadgeSize = 'small' | 'medium';

export interface StatusBadgeBaseProps {
  status: StatusType;
  label?: string;
  showDot?: boolean;
  size?: StatusBadgeSize;
  transparent?: boolean;
}

export interface StatusBadgeWebProps extends StatusBadgeBaseProps {
  onClick?: () => void;
  className?: string;
}

export interface StatusBadgeNativeProps extends StatusBadgeBaseProps {
  onPress?: () => void;
}

export interface StatusDotProps {
  status: StatusType;
  size?: number;
}
