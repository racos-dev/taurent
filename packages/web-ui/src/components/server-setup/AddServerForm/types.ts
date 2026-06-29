import type { TestConnectionResult } from '@taurent/shared/types/server';

export type AddServerFormBodyVariant = 'desktop' | 'mobile';

export interface AddServerFormBodyProps {
  variant?: AddServerFormBodyVariant;

  // ServerConnectionFields props
  name?: string;
  onNameChange?: (value: string) => void;
  url: string;
  onUrlChange: (value: string) => void;
  username: string;
  onUsernameChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  rememberPassword?: boolean;
  onRememberPasswordChange?: (value: boolean) => void;

  // Per-field validation errors from the controller
  validationErrors?: {
    name?: string | null;
    url?: string | null;
    username?: string | null;
  };

  // State
  error?: string | null;
  testResult?: TestConnectionResult | null;
  testingConnection?: boolean;
  loading?: boolean;

  // Actions
  onTestConnection?: () => void;
  onSubmit?: () => void;

  /** Actionable suggestion when test connection fails */
  testErrorSuggestion?: string | null;
}
