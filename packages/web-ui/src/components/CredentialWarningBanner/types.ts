import type { ReactNode } from 'react';
import type { CredentialStatus } from '@taurent/shared/types/server';

export interface CredentialWarningBannerProps {
  warning: string;
  credentialStatus?: CredentialStatus;
  onDismiss?: () => void;
  action?: ReactNode;
  className?: string;
}
