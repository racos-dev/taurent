import React from 'react';
import { Button } from '../../primitives/Button';
import type { RetryButtonProps } from './types';

export const RetryButton = React.memo<RetryButtonProps>(({
  onClick,
  label = 'Retry',
  className = '',
  disabled = false,
}) => {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {label}
    </Button>
  );
});

RetryButton.displayName = 'RetryButton';