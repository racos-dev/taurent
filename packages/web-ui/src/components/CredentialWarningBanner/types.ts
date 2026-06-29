import type { ReactNode } from 'react';

export interface CredentialWarningBannerProps {
  warning: string;
  onDismiss?: () => void;
  action?: ReactNode;
  className?: string;
}
