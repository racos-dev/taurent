import type { CredentialStatus } from '@taurent/shared/types/server';

export interface CredentialHealthIndicatorProps {
  credentialStatus: CredentialStatus;
  className?: string;
}
