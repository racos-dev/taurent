import type { ReactNode } from 'react';

export interface InspectorSectionProps {
  /** Section title shown at the top. */
  title?: string;
  children: ReactNode;
  className?: string;
}
