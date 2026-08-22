import React from 'react';
import { Input } from '@taurent/web-ui';
import { cn, useTaurentTranslation } from '@taurent/shared';
import { Checkbox } from '../../primitives/Checkbox';
import { ToggleSwitch } from '../../primitives/ToggleSwitch';
import type { ServerConnectionFieldsProps } from './types';

/**
 * Shared server connection fields component.
 * Renders name (optional), URL, username, password, and an optional API key toggle.
 * Platform styles are applied by the consumer via Tailwind classes.
 */
export const ServerConnectionFields: React.FC<ServerConnectionFieldsProps> = React.memo(({
  name,
  onNameChange,
  namePlaceholder,
  showNameField = false,
  url,
  onUrlChange,
  urlPlaceholder = 'http://localhost:8080',
  username,
  onUsernameChange,
  usernamePlaceholder = 'admin',
  password,
  onPasswordChange,
  passwordPlaceholder = '',
  apiKey = '',
  onApiKeyChange,
  apiKeyPlaceholder = 'qbt_...',
  useApiKey = false,
  onUseApiKeyChange,
  rememberPassword,
  onRememberPasswordChange,
  disabled = false,
  className = '',
  validationErrors,
}) => {
  const { t } = useTaurentTranslation('auth');
  const showApiKeyToggle = Boolean(onApiKeyChange && onUseApiKeyChange);
  const resolvedNamePlaceholder = namePlaceholder ?? t('form.serverNamePlaceholder');

  return (
    <div className={cn('space-y-4', className)}>
      {showNameField && (
        <Input
          label={t('server.name')}
          value={name ?? ''}
          onChange={(value) => onNameChange?.(value)}
          placeholder={resolvedNamePlaceholder}
          disabled={disabled}
          error={validationErrors?.name ?? undefined}
        />
      )}

      <Input
        label={t('form.serverUrlRequired')}
        value={url}
        onChange={onUrlChange}
        placeholder={urlPlaceholder}
        disabled={disabled}
        error={validationErrors?.url ?? undefined}
        helperText={t('form.serverUrlHelper')}
      />

      <Input
        label={useApiKey ? t('form.username') : t('form.usernameRequired')}
        value={username}
        onChange={onUsernameChange}
        placeholder={usernamePlaceholder}
        disabled={disabled || useApiKey}
        error={validationErrors?.username ?? undefined}
      />

      <Input
        label={useApiKey ? t('form.apiKey') : t('form.password')}
        type={useApiKey ? 'text' : 'password'}
        value={useApiKey ? apiKey : password}
        onChange={useApiKey ? onApiKeyChange : onPasswordChange}
        placeholder={useApiKey ? apiKeyPlaceholder : passwordPlaceholder}
        disabled={disabled}
      />

      {onRememberPasswordChange && !useApiKey && (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Checkbox
            checked={rememberPassword ?? false}
            onChange={onRememberPasswordChange}
            disabled={disabled}
          />
          <span className="text-sm text-text-secondary">
            {t('form.rememberPassword')}
          </span>
        </label>
      )}

      {showApiKeyToggle && onUseApiKeyChange && (
        <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
          <span className="text-sm text-text-secondary">{t('form.useApiKey')}</span>
          <ToggleSwitch checked={useApiKey} onChange={onUseApiKeyChange} />
        </label>
      )}
    </div>
  );
});

ServerConnectionFields.displayName = 'ServerConnectionFields';
