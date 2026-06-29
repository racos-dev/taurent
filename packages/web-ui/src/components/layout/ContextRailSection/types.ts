import type { ReactNode } from 'react';

export interface ContextRailSectionProps {
  /** Optional section title. */
  title?: string;
  /** Optional section description. */
  description?: string;
  children: ReactNode;
  className?: string;
}
