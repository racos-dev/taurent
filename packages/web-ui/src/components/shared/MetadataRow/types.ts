import type { ReactNode } from 'react';

export interface MetadataRowProps {
  label: string;
  /** Plain text value. Use `children` for custom content. */
  value?: string;
  /** Custom content area (overrides `value`). */
  children?: ReactNode;
  className?: string;
}
