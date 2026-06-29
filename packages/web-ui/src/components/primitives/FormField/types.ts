import type { ReactNode } from 'react';

export interface FormFieldProps {
  label?: string;
  description?: string;
  /** Validation error message; rendered in error color when present. */
  error?: string;
  children: ReactNode;
  className?: string;
}
