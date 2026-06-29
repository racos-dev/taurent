import type { ReactNode } from 'react';

export interface WorkspaceFrameProps {
  /** Platform variant drives layout composition. */
  variant?: 'desktop' | 'mobile';
  /** Optional header region (top bar). */
  header?: ReactNode;
  /** Optional left rail region (desktop only; ignored on mobile). */
  rail?: ReactNode;
  /** Primary content region. */
  content?: ReactNode;
  /** Optional docked inspector region (desktop only; ignored on mobile). */
  inspector?: ReactNode;
  /** Optional footer region (status strip). */
  footer?: ReactNode;
  /** Applied to the root flex container. */
  className?: string;
  /** Applied to the header region wrapper. */
  headerClassName?: string;
  /** Applied to the body flex row (desktop only). */
  bodyRowClassName?: string;
  /** Applied to the rail region wrapper (desktop only). */
  railClassName?: string;
  /** Applied to the content region wrapper. */
  contentClassName?: string;
  /** Applied to the inspector region wrapper (desktop only). */
  inspectorClassName?: string;
  /** Applied to the footer region wrapper. */
  footerClassName?: string;
}
