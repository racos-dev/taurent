import React, { useCallback } from 'react';
import { Input } from '../../primitives/Input';
import { Button } from '../../primitives/Button';
import { Checkbox } from '../../primitives/Checkbox';
import { ToggleSwitch } from '../../primitives/ToggleSwitch';
import { Spinner } from '../../shared/Spinner';

export interface AddServerFormProps {
  name: string;
  url: string;
  username: string;
  password: string;
  apiKey: string;
  rememberPassword: boolean;
  useApiKey: boolean;
  onNameChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onRememberPasswordChange: (value: boolean) => void;
  onUseApiKeyChange: (value: boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
  validationErrors?: {
    name?: string | null;
    url?: string | null;
    username?: string | null;
  };
  urlSuggestion?: string | null;
  error?: string | null;
  isSubmitting?: boolean;
}

export const AddServerForm = React.memo<AddServerFormProps>(
  ({
    name,
    url,
    username,
    password,
    apiKey,
    rememberPassword,
    useApiKey,
    onNameChange,
    onUrlChange,
    onUsernameChange,
    onPasswordChange,
    onApiKeyChange,
    onRememberPasswordChange,
    onUseApiKeyChange,
    onSubmit,
    onCancel,
    validationErrors,
    urlSuggestion,
    error,
    isSubmitting = false,
  }) => {
    const isFormValid =
      name.trim().length > 0 &&
      url.trim().length > 0 &&
      (useApiKey || username.trim().length > 0) &&
      !validationErrors?.name &&
      !validationErrors?.url &&
      !validationErrors?.username;

    const handleSubmit = useCallback(
      (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!isFormValid || isSubmitting) return;
        onSubmit();
      },
      [isFormValid, isSubmitting, onSubmit],
    );

    const credentialLabel = useApiKey ? 'API Key' : 'Password';
    const credentialPlaceholder = useApiKey
      ? 'qbt_...'
      : 'Enter your password';

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-sm border border-error bg-error-20 p-3 text-sm text-error">
            {error}
          </div>
        )}

        <Input
          label="Server Name *"
          value={name}
          onChange={onNameChange}
          placeholder="My Home Server"
          disabled={isSubmitting}
          error={validationErrors?.name ?? undefined}
        />

        <Input
          label="Server URL *"
          value={url}
          onChange={onUrlChange}
          placeholder="https://server:8080"
          disabled={isSubmitting}
          error={validationErrors?.url ?? undefined}
          helperText="e.g., localhost:8080 or https://server:8080"
        />

        {urlSuggestion && (
          <p className="-mt-2 text-sm text-text-secondary">
            Did you mean{' '}
            <button
              type="button"
              onClick={() => onUrlChange(urlSuggestion)}
              className="font-medium text-primary underline underline-offset-2 hover:opacity-90"
            >
              {urlSuggestion}
            </button>
            ?
          </p>
        )}

        {!useApiKey && (
          <Input
            label="Username *"
            value={username}
            onChange={onUsernameChange}
            placeholder="admin"
            disabled={isSubmitting}
            error={validationErrors?.username ?? undefined}
          />
        )}

        <Input
          label={credentialLabel}
          type={useApiKey ? 'text' : 'password'}
          value={useApiKey ? apiKey : password}
          onChange={useApiKey ? onApiKeyChange : onPasswordChange}
          placeholder={credentialPlaceholder}
          disabled={isSubmitting}
        />

        {!useApiKey && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={rememberPassword}
              onChange={onRememberPasswordChange}
              disabled={isSubmitting}
            />
            <span className="text-sm text-text-secondary">Remember password</span>
          </label>
        )}

        <label className="flex items-center justify-between gap-3 rounded-sm border border-border bg-surface p-3 cursor-pointer select-none transition-colors hover:border-border-focus">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text-primary">Use API Key</span>
            <span className="text-xs text-text-secondary">
              Authenticate with a qBittorrent API key instead of a username and password
            </span>
          </div>
          <ToggleSwitch checked={useApiKey} onChange={onUseApiKeyChange} />
        </label>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="sm:flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className="sm:flex-1"
          >
            {isSubmitting ? (
              <>
                <Spinner variant="ring" size="md" />
                Adding...
              </>
            ) : (
              'Add Server'
            )}
          </Button>
        </div>
      </form>
    );
  },
);

AddServerForm.displayName = 'AddServerForm';
