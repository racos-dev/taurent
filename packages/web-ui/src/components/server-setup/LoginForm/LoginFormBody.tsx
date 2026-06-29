import React from 'react';
import { ServerConnectionFields } from '../ServerConnectionFields';
import { Button } from '../../primitives/Button';
import type { LoginFormBodyProps } from './types';

export const LoginFormBody = React.memo<LoginFormBodyProps>(({
  url,
  onUrlChange,
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  isConnecting,
  locationError,
  connectError,
}) => {
  return (
    <>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Connect to qBittorrent</h1>
      {locationError && (
        <div className="mb-4 p-3 bg-error-20 border border-error rounded-sm text-error text-sm">
          {locationError}
        </div>
      )}
      {connectError && (
        <div className="mb-4 p-3 bg-error-20 border border-error rounded-sm text-error text-sm">
          {connectError.includes('browser mode') ? (
            <>
              <strong>CORS Error Detected</strong>
              <p className="mt-1">{connectError}</p>
              <p className="mt-2 text-xs text-error">
                This may be caused by running the app in a browser instead of the desktop or mobile client.
              </p>
            </>
          ) : (
            connectError
          )}
        </div>
      )}
      <ServerConnectionFields
        url={url}
        onUrlChange={onUrlChange}
        username={username}
        onUsernameChange={onUsernameChange}
        password={password}
        onPasswordChange={onPasswordChange}
        showNameField={false}
      />
      <Button type="submit" className="w-full" disabled={isConnecting}>
        {isConnecting ? 'Connecting...' : 'Connect'}
      </Button>
    </>
  );
});

LoginFormBody.displayName = 'LoginFormBody';
