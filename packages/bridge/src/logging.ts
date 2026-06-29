// Shared Tauri logging setup - used by both desktop and mobile
import { isTauri } from '@tauri-apps/api/core';
import {
  attachLogger,
  LogLevel,
  debug as logDebug,
  error as logError,
  info as logInfo,
  trace as logTrace,
  warn as logWarn,
} from '@tauri-apps/plugin-log';

type ConsoleMethod = 'debug' | 'error' | 'info' | 'log' | 'warn';
type LogFunction = (message: string) => Promise<void>;

const WEB_LOG_PREFIX = '[web]';
const RUNTIME_LOG_PREFIX = '[runtime]';

/* eslint-disable no-console */
const originalConsole: Record<ConsoleMethod, (...args: unknown[]) => void> = {
  debug: console.debug.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
  log: console.log.bind(console),
  warn: console.warn.bind(console),
};
/* eslint-enable no-console */

function formatLogValue(value: unknown): string {
  if (value instanceof Error) {
    return value.stack ?? `${value.name}: ${value.message}`;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'undefined') {
    return 'undefined';
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatLogMessage(args: unknown[]): string {
  return args.map(formatLogValue).join(' ');
}

function getConsoleMethod(level: LogLevel): ConsoleMethod {
  switch (level) {
    case LogLevel.Trace:
      return 'log';
    case LogLevel.Debug:
      return 'debug';
    case LogLevel.Info:
      return 'info';
    case LogLevel.Warn:
      return 'warn';
    case LogLevel.Error:
      return 'error';
    default:
      return 'log';
  }
}

function forwardConsoleMethod(method: ConsoleMethod, logger: LogFunction): void {
  const originalMethod = originalConsole[method];

  // eslint-disable-next-line no-console
  console[method] = (...args: unknown[]): void => {
    originalMethod(...args);

    const message = formatLogMessage(args);

    void logger(`${WEB_LOG_PREFIX} ${message}`).catch((error: unknown) => {
      originalConsole.error('[logging] Failed to forward console message', error);
    });
  };
}

async function attachRuntimeLogs(): Promise<void> {
  await attachLogger((event: { level: LogLevel; message: string }) => {
    if (event.message.startsWith(WEB_LOG_PREFIX)) {
      return;
    }

    originalConsole[getConsoleMethod(event.level)](`${RUNTIME_LOG_PREFIX} ${event.message}`);
  });
}

export async function setupTauriLogging(isDevelopment: boolean): Promise<void> {
  if (!isTauri()) {
    return;
  }

  await attachRuntimeLogs();

  if (isDevelopment) {
    forwardConsoleMethod('log', logTrace);
    forwardConsoleMethod('debug', logDebug);
    forwardConsoleMethod('info', logInfo);
    forwardConsoleMethod('warn', logWarn);
    forwardConsoleMethod('error', logError);
  } else {
    // Production: forward warn/error only to avoid log spam
    forwardConsoleMethod('warn', logWarn);
    forwardConsoleMethod('error', logError);
  }
}
