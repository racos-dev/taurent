import React from 'react';
import type { WorkspaceFrameProps } from './types';
import { cn } from '@taurent/shared';

export const WorkspaceFrame = React.memo<WorkspaceFrameProps>(({
  variant = 'desktop',
  header,
  rail,
  content,
  inspector,
  footer,
  className = '',
  headerClassName = '',
  bodyRowClassName = '',
  railClassName = '',
  contentClassName = '',
  inspectorClassName = '',
  footerClassName = '',
}) => {
  if (variant === 'mobile') {
    return (
      <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}>
        {header && <div className={cn('shrink-0', headerClassName)}>{header}</div>}
        <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-none', contentClassName)}>
          {content}
        </div>
        {footer && <div className={cn('shrink-0', footerClassName)}>{footer}</div>}
      </div>
    );
  }

  // desktop multi-pane
  return (
    <div className={cn('flex flex-col h-full', className)}>
      {header && <div className={cn('shrink-0', headerClassName)}>{header}</div>}
      <div className={cn('flex flex-1 overflow-hidden min-h-0', bodyRowClassName)}>
        {rail && <div className={cn('shrink-0 overflow-y-auto border-r border-border', railClassName)}>{rail}</div>}
        <div className={cn('flex-1 min-h-0 overflow-hidden', contentClassName)}>{content}</div>
        {inspector && <div className={cn('shrink-0 overflow-y-auto border-l border-border', inspectorClassName)}>{inspector}</div>}
      </div>
      {footer && <div className={cn('shrink-0', footerClassName)}>{footer}</div>}
    </div>
  );
});

WorkspaceFrame.displayName = 'WorkspaceFrame';
