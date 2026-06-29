import React from 'react';
import { Spinner } from '@taurent/web-ui';

export interface AuthLoadingScreenProps {
  text?: string;
}

export const AuthLoadingScreen = React.memo<AuthLoadingScreenProps>(({ text = 'Connecting...' }) => {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background">
      <Spinner variant="ring" size="lg" />
      <p className="mt-4 text-sm text-text-secondary">{text}</p>
    </div>
  );
});

AuthLoadingScreen.displayName = 'AuthLoadingScreen';
