import { useState, useCallback } from 'react';
import type { TestConnectionResult } from '@taurent/bridge/types';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';

export interface UseTestServerConnectionOptions {
  testServerConnection: (url: string, username: string, password: string) => Promise<TestConnectionResult>;
}

export interface UseTestServerConnectionResult {
  test: (url: string, username: string, password: string) => Promise<boolean>;
  isTesting: boolean;
  testResult: TestConnectionResult | null;
  testError: string | null;
  clearTestResult: () => void;
}

export function useTestServerConnection({
  testServerConnection,
}: UseTestServerConnectionOptions): UseTestServerConnectionResult {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const test = useCallback(
    async (url: string, username: string, password: string): Promise<boolean> => {
      setIsTesting(true);
      setTestResult(null);
      setTestError(null);

      try {
        const result = await testServerConnection(url, username, password);
        setTestResult(result);
        return result.success;
    } catch (err) {
        const errorMessage = formatUserMessageForContext(err, 'connection');
        setTestError(errorMessage);
        setTestResult({ success: false, error: errorMessage });
        return false;
      } finally {
        setIsTesting(false);
      }
    },
    [testServerConnection],
  );

  const clearTestResult = useCallback(() => {
    setTestResult(null);
    setTestError(null);
  }, []);

  return {
    test,
    isTesting,
    testResult,
    testError,
    clearTestResult,
  };
}
