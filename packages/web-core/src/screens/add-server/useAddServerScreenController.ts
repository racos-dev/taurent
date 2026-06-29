// Headless controller for AddServerScreen orchestration.
//
// Platform-agnostic — does not import @tauri-apps/* or produce UI.
//
// Extracts form field state, validation, test connection flow, and add-server
// submission from the desktop/mobile AddServerScreen routes into a reusable
// shared hook. UI rendering stays in the app route shell; this hook owns
// the headless state machine.
//
// Usage (mobile/desktop AddServerScreen):
//   const controller = useAddServerScreenController({
//     addServer,
//     bridgeServers: BridgeAdapter.servers,
//     onSuccess: (serverId) => { /* navigate */ },
//     onCancel: () => { /* navigate */ },
//   });

import { useState, useCallback, useMemo } from 'react';
import type { TestConnectionResult } from '@taurent/shared/types/server';
import { formatUserMessageForContext, getErrorMessage } from '@taurent/shared/utils/error';
import type { ServerUrlProbeBridge } from '@taurent/bridge';
import { validateUrl } from './normalizeUrl';
import { mapTestErrorToSuggestion } from './mapTestErrorToSuggestion';

// ─── Input types ─────────────────────────────────────────────────────────────

export interface AddServerScreenControllerOptions {
  /** Add a new server and return the created server summary */
  addServer: (name: string, url: string, username: string, password: string, rememberPassword?: boolean) => Promise<{ id: string }>;
  /** Called after successful server addition with the new server id */
  onSuccess: (serverId: string) => void | Promise<void>;
  /** Bridge servers interface for normalization and scheme probing */
  bridgeServers: ServerUrlProbeBridge;
}

// ─── Output types ────────────────────────────────────────────────────────────

export interface AddServerScreenControllerResult {
  // ─── Form fields ───────────────────────────────────────────
  name: string;
  url: string;
  username: string;
  password: string;
  rememberPassword: boolean;
  setName: (value: string) => void;
  setUrl: (value: string) => void;
  setUsername: (value: string) => void;
  setPassword: (value: string) => void;
  setRememberPassword: (value: boolean) => void;

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

  // ─── Test connection ──────────────────────────────────────
  testResult: TestConnectionResult | null;
  isTesting: boolean;
  handleTestConnection: () => Promise<TestConnectionResult | null>;
  clearTestResult: () => void;

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
  const [password, setPassword] = useState('');
  const [rememberPassword, setRememberPassword] = useState(true);

  // ─── Error state ──────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);

  // ─── Test connection state ────────────────────────────────
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // ─── Submit state ─────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Validation state ─────────────────────────────────────
  const [validationErrors, setValidationErrors] = useState<{
    name?: string | null;
    url?: string | null;
    username?: string | null;
  }>({});

  const [urlSuggestion, setUrlSuggestion] = useState<string | null>(null);

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

  // ─── Derived ───────────────────────────────────────────────
  const isFormValid = useMemo(() => {
    return (
      name.trim().length > 0 &&
      url.trim().length > 0 &&
      username.trim().length > 0 &&
      !validationErrors.name &&
      !validationErrors.url &&
      !validationErrors.username
    );
  }, [name, url, username, validationErrors]);

  // ─── Test connection ──────────────────────────────────────
  const handleTestConnection = useCallback(async (): Promise<TestConnectionResult | null> => {
    if (!url.trim() || !username.trim()) {
      return null;
    }

    setIsTesting(true);
    setTestResult(null);
    setError(null);
    setUrlSuggestion(null);

    try {
      // Probe scheme via bridge (handles https-first, http-fallback internally)
      const probe = await bridgeServers.probeServerScheme(url.trim(), username.trim(), password);

      if (probe.success && probe.normalizedUrl) {
        setUrlState(probe.normalizedUrl);
        const result: TestConnectionResult = { success: true };
        setTestResult(result);
        return result;
      } else {
        const errorMsg = probe.error || 'Connection failed';
        const result: TestConnectionResult = {
          success: false,
          error: formatUserMessageForContext(errorMsg, 'add-server'),
        };
        setTestResult(result);
        setUrlSuggestion(mapTestErrorToSuggestion(errorMsg));
        return result;
      }
    } catch (err) {
      const message = getErrorMessage(err);
      const result = {
        success: false,
        error: formatUserMessageForContext(err, 'add-server'),
      };
      setTestResult(result);
      setUrlSuggestion(mapTestErrorToSuggestion(message));
      return result;
    } finally {
      setIsTesting(false);
    }
  }, [url, username, password, bridgeServers]);

  const clearTestResult = useCallback(() => {
    setTestResult(null);
    setUrlSuggestion(null);
  }, []);

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

      // If no scheme, probe to detect https vs http
      let finalUrl: string;
      if (!trimmedUrl.includes('://')) {
        const probe = await bridgeServers.probeServerScheme(trimmedUrl, username.trim(), password);
        if (probe.success && probe.normalizedUrl) {
          finalUrl = probe.normalizedUrl;
        } else {
          // Fall back to normalization (defaults to https) if probe fails
          const { normalized } = await bridgeServers.normalizeServerUrl({ url: trimmedUrl });
          finalUrl = normalized;
        }
      } else {
        const { normalized } = await bridgeServers.normalizeServerUrl({ url: trimmedUrl });
        finalUrl = normalized;
      }

      if (finalUrl !== url) {
        setUrlState(finalUrl);
      }
      const newServer = await addServer(name.trim(), finalUrl, username.trim(), password, rememberPassword);
      await onSuccess(newServer.id);
    } catch (err) {
      setError(formatUserMessageForContext(err, 'add-server'));
    } finally {
      setIsSubmitting(false);
    }
  }, [isFormValid, name, url, username, password, rememberPassword, addServer, onSuccess, bridgeServers]);

  return {
    name,
    url,
    username,
    password,
    rememberPassword,
    setName,
    setUrl,
    setUsername,
    setPassword,
    setRememberPassword,
    validationErrors,
    urlSuggestion,
    isFormValid,
    error,
    testResult,
    isTesting,
    handleTestConnection,
    clearTestResult,
    isSubmitting,
    handleSubmit,
  };
}
