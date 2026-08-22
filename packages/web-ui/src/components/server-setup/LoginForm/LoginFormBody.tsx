import React from 'react';
import { useTaurentTranslation } from '@taurent/shared';
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
  const { t } = useTaurentTranslation('auth');

  return (
    <>
      <h1 className="text-2xl font-bold text-text-primary mb-6">{t('form.connectTitle')}</h1>
      {locationError && (
        <div className="mb-4 p-3 bg-error-20 border border-error rounded-sm text-error text-sm">
          {locationError}
        </div>
      )}
      {connectError && (
        <div className="mb-4 p-3 bg-error-20 border border-error rounded-sm text-error text-sm">
          {connectError.includes('browser mode') ? (
            <>
              <strong>{t('form.corsTitle')}</strong>
              <p className="mt-1">{connectError}</p>
              <p className="mt-2 text-xs text-error">
                {t('form.browserHint')}
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
        {isConnecting ? t('form.connecting') : t('form.connect')}
      </Button>
    </>
  );
});

LoginFormBody.displayName = 'LoginFormBody';
