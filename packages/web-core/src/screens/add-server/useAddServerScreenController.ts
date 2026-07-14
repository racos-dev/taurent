// Headless controller for AddServerScreen orchestration.
//
// Platform-agnostic — does not import @tauri-apps/* or produce UI.
//
// Extracts form field state, validation, and add-server submission from the
// desktop/mobile AddServerScreen routes into a reusable shared hook. UI
// rendering stays in the app route shell; this hook owns the headless state.
//
// Usage (mobile/desktop AddServerScreen):
//   const controller = useAddServerScreenController({
//     addServer,
//     bridgeServers,
//     onSuccess: (serverId) => { /* navigate */ },
//     onCancel: () => { /* navigate */ },
//   });

import { useState, useCallback, useMemo } from 'react';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';
import { validateUrl } from './normalizeUrl';

// ─── Input types ─────────────────────────────────────────────────────────────

export interface AddServerScreenControllerOptions {
  /** Add a new server and return the created server summary */
  addServer: (
    name: string,
    url: string,
    username: string,
    password: string,
    rememberPassword?: boolean,
    apiKey?: string,
  ) => Promise<{ id: string }>;
  /** Called after successful server addition with the new server id */
  onSuccess: (serverId: string) => void | Promise<void>;
  /** Bridge servers interface for URL normalization */
  bridgeServers: {
    normalizeServerUrl(input: { url: string; defaultScheme?: string }): Promise<{ normalized: string }>;
  };
}

// ─── Output types ────────────────────────────────────────────────────────────

export interface AddServerScreenControllerResult {
  // ─── Form fields ───────────────────────────────────────────
  name: string;
  url: string;
  username: string;
  password: string;
  apiKey: string;
  rememberPassword: boolean;
  useApiKey: boolean;
  setName: (value: string) => void;
  setUrl: (value: string) => void;
  setUsername: (value: string) => void;
  setPassword: (value: string) => void;
  setApiKey: (value: string) => void;
  setRememberPassword: (value: boolean) => void;
  setUseApiKey: (value: boolean) => void;

  // ─── Validation ────────────────────────────────────────────
  validationErrors: {
    name?: string | null;
    url?: string | null;
    username?: string | null;
  };
  urlSuggestion: string | null;

  // ─── Derived state ────────────────────────────────────────
  isFormValid: boolean;
  error: string | null;

  // ─── Submit ───────────────────────────────────────────────
  isSubmitting: boolean;
  handleSubmit: () => Promise<void>;
}

// ─── Implementation ─────────────────────────────────────────────────────────

export function useAddServerScreenController({
  addServer,
  onSuccess,
  bridgeServers,
}: AddServerScreenControllerOptions): AddServerScreenControllerResult {
  // ─── Form fields ───────────────────────────────────────────
  const [name, setNameState] = useState('');
  const [url, setUrlState] = useState('');
  const [username, setUsernameState] = useState('');
  const [password, setPasswordState] = useState('');
  const [apiKey, setApiKeyState] = useState('');
  const [rememberPassword, setRememberPasswordState] = useState(true);
  const [useApiKey, setUseApiKeyState] = useState(false);

  // ─── Error state ──────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);

  // ─── Submit state ─────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Validation state ─────────────────────────────────────
  const [validationErrors, setValidationErrors] = useState<{
    name?: string | null;
    url?: string | null;
    username?: string | null;
  }>({});

  // ─── Field setters with validation ───────────────────────
  const setName = useCallback((value: string) => {
    setNameState(value);
    const trimmed = value.trim();
    setValidationErrors((prev) => ({
      ...prev,
      name: trimmed.length === 0 ? 'Name is required' : null,
    }));
  }, []);

  const setUrl = useCallback((value: string) => {
    const trimmed = value.trim();
    setUrlState(trimmed);
    const urlError = validateUrl(trimmed);
    setValidationErrors((prev) => ({
      ...prev,
      url: urlError,
    }));
  }, []);

  const setUsername = useCallback((value: string) => {
    setUsernameState(value);
    const trimmed = value.trim();
    setValidationErrors((prev) => ({
      ...prev,
      username: trimmed.length === 0 ? 'Username is required' : null,
    }));
  }, []);

  const setPassword = useCallback((value: string) => {
    setPasswordState(value);
  }, []);

  const setApiKey = useCallback((value: string) => {
    setApiKeyState(value);
  }, []);

  const setRememberPassword = useCallback((value: boolean) => {
    setRememberPasswordState(value);
  }, []);

  const setUseApiKey = useCallback((value: boolean) => {
    setUseApiKeyState(value);
    if (value) {
      // Clear username validation when switching to API key mode
      setValidationErrors((prev) => ({ ...prev, username: null }));
    }
  }, []);

  // ─── Derived ───────────────────────────────────────────────
  const isFormValid = useMemo(() => {
    const hasName = name.trim().length > 0;
    const hasUrl = url.trim().length > 0;
    const hasUsername = useApiKey || username.trim().length > 0;
    const hasApiKey = !useApiKey || apiKey.trim().length > 0;
    const hasNoErrors =
      !validationErrors.name && !validationErrors.url && !validationErrors.username;
    return hasName && hasUrl && hasUsername && hasApiKey && hasNoErrors;
  }, [name, url, username, apiKey, useApiKey, validationErrors]);

  // ─── Submit ───────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!isFormValid) {
      setError('Please fill in all required fields');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const trimmedUrl = url.trim();
      const normalizeInput = trimmedUrl.includes('://')
        ? { url: trimmedUrl }
        : { url: trimmedUrl, defaultScheme: '' };
      const { normalized } = await bridgeServers.normalizeServerUrl(normalizeInput);
      const finalUrl = normalized;

      if (finalUrl !== url) {
        setUrlState(finalUrl);
      }

      const newServer = await addServer(
        name.trim(),
        finalUrl,
        useApiKey ? '' : username.trim(),
        useApiKey ? '' : password,
        rememberPassword,
        useApiKey ? apiKey.trim() : undefined,
      );
      await onSuccess(newServer.id);
    } catch (err) {
      setError(formatUserMessageForContext(err, 'add-server'));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isFormValid,
    name,
    url,
    username,
    password,
    apiKey,
    rememberPassword,
    useApiKey,
    addServer,
    onSuccess,
    bridgeServers,
  ]);

  return {
    name,
    url,
    username,
    password,
    apiKey,
    rememberPassword,
    useApiKey,
    setName,
    setUrl,
    setUsername,
    setPassword,
    setApiKey,
    setRememberPassword,
    setUseApiKey,
    validationErrors,
    urlSuggestion: null,
    isFormValid,
    error,
    isSubmitting,
    handleSubmit,
  };
}
