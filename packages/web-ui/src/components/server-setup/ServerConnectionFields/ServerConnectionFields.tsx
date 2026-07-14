import React from 'react';
import { Input } from '@taurent/web-ui';
import { cn } from '@taurent/shared';
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
  namePlaceholder = 'My Home Server',
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
  const showApiKeyToggle = Boolean(onApiKeyChange && onUseApiKeyChange);

  return (
    <div className={cn('space-y-4', className)}>
      {showNameField && (
        <Input
          label="Server Name"
          value={name ?? ''}
          onChange={(value) => onNameChange?.(value)}
          placeholder={namePlaceholder}
          disabled={disabled}
          error={validationErrors?.name ?? undefined}
        />
      )}

      <Input
        label="Server URL *"
        value={url}
        onChange={onUrlChange}
        placeholder={urlPlaceholder}
        disabled={disabled}
        error={validationErrors?.url ?? undefined}
        helperText="e.g., localhost:8080 or https://server:8080"
      />

      <Input
        label={useApiKey ? 'Username' : 'Username *'}
        value={username}
        onChange={onUsernameChange}
        placeholder={usernamePlaceholder}
        disabled={disabled || useApiKey}
        error={validationErrors?.username ?? undefined}
      />

      <Input
        label={useApiKey ? 'API Key' : 'Password'}
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
            Remember password
          </span>
        </label>
      )}

      {showApiKeyToggle && onUseApiKeyChange && (
        <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
          <span className="text-sm text-text-secondary">Use API Key</span>
          <ToggleSwitch checked={useApiKey} onChange={onUseApiKeyChange} />
        </label>
      )}
    </div>
  );
});

ServerConnectionFields.displayName = 'ServerConnectionFields';
