import { toast as sonnerToast, type ExternalToast } from 'sonner';

export interface ToastOptions extends ExternalToast {
  dedupeKey?: string;
}

function normalizeDedupeKey(message: string): string {
  return message.trim().replace(/\s+/g, ' ').toLowerCase();
}

function resolveToastId(kind: string, message: string | undefined, options?: ToastOptions): string | number | undefined {
  if (options?.id !== undefined) {
    return options.id;
  }

  if (options?.dedupeKey) {
    return `${kind}:${options.dedupeKey}`;
  }

  if (!message) {
    return undefined;
  }

  return `${kind}:${normalizeDedupeKey(message)}`;
}

function withToastId(message: string | undefined, options?: ToastOptions): ExternalToast | undefined {
  if (!options && message === undefined) {
    return undefined;
  }

  return {
    ...options,
    id: resolveToastId('toast', message, options),
  };
}

function withErrorToastId(message: string | undefined, options?: ToastOptions): ExternalToast | undefined {
  if (!options && message === undefined) {
    return undefined;
  }

  return {
    ...options,
    id: resolveToastId('error', message, options),
  };
}

type ToastFn = typeof sonnerToast & {
  error(message: string, options?: ToastOptions): string | number;
};

const toastImpl = ((message: string, options?: ToastOptions) => {
  return sonnerToast(message, withToastId(message, options));
}) as ToastFn;

Object.assign(toastImpl, sonnerToast, {
  error(message: string, options?: ToastOptions) {
    return sonnerToast.error(message, withErrorToastId(message, options));
  },
});

export const toast = toastImpl;
