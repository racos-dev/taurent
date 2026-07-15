export interface ServerConnectionFieldsProps {
  /** Server display name (optional - hidden on login screens) */
  name?: string;
  onNameChange?: (value: string) => void;
  namePlaceholder?: string;
  showNameField?: boolean;

  /** Server URL */
  url: string;
  onUrlChange: (value: string) => void;
  urlPlaceholder?: string;

  /** Username */
  username: string;
  onUsernameChange: (value: string) => void;
  usernamePlaceholder?: string;

  /** Password */
  password: string;
  onPasswordChange: (value: string) => void;
  passwordPlaceholder?: string;

  /** API Key (used when useApiKey is true) */
  apiKey?: string;
  onApiKeyChange?: (value: string) => void;
  apiKeyPlaceholder?: string;

  /** Toggle API key authentication */
  useApiKey?: boolean;
  onUseApiKeyChange?: (value: boolean) => void;

  /** Remember password checkbox (optional - hidden by default) */
  rememberPassword?: boolean;
  onRememberPasswordChange?: (value: boolean) => void;

  /** Disable all inputs (e.g., while loading) */
  disabled?: boolean;

  /** Optional className for the container */
  className?: string;

  /** Per-field validation errors */
  validationErrors?: {
    name?: string | null;
    url?: string | null;
    username?: string | null;
  };
}
