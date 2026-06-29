import type { ReactNode } from 'react';

export interface RemoteSectionContainerProps {
  isLoading: boolean;
  error: Error | null;
  connectionError: string | null;
  saveError: Error | null;
  hasActiveServer: boolean;
  hasSavedServers: boolean;
  currentServerName: string | null;
  preferences: Record<string, unknown> | null | undefined;
  onRetry: () => void;
  onOpenServerOverview: () => void;
  children: ReactNode;
}
