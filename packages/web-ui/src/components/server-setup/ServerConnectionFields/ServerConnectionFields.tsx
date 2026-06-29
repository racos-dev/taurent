import React from 'react';
import { Input } from '@taurent/web-ui';
import { cn } from '@taurent/shared';
import { Checkbox } from '../../primitives/Checkbox';
import type { ServerConnectionFieldsProps } from './types';

/**
 * Shared server connection fields component.
 * Renders name (optional), URL, username, and password fields.
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
  rememberPassword,
  onRememberPasswordChange,
  disabled = false,
  className = '',
  validationErrors,
}) => {
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
        label="Username *"
        value={username}
        onChange={onUsernameChange}
        placeholder={usernamePlaceholder}
        disabled={disabled}
        error={validationErrors?.username ?? undefined}
      />

      <Input
        label="Password"
        type="password"
        value={password}
        onChange={onPasswordChange}
        placeholder={passwordPlaceholder}
        disabled={disabled}
      />

      {onRememberPasswordChange && (
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
    </div>
  );
});

ServerConnectionFields.displayName = 'ServerConnectionFields';
