export interface LoggerConfig {
  component?: string;
}

export interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

export function createLogger(config?: LoggerConfig): Logger {
  const prefix = config?.component ? `[${config.component}]` : '';

  return {
    info: (...args: unknown[]) => console.info(prefix, ...args),
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
    debug: (...args: unknown[]) => console.info(prefix, ...args),
  };
}

export const logger = createLogger();
