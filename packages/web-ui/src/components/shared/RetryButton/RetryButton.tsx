import React from 'react';
import { Button } from '../../primitives/Button';
import type { RetryButtonProps } from './types';
import { useTaurentTranslation } from '@taurent/shared/i18n';

export const RetryButton = React.memo<RetryButtonProps>(({
  onClick,
  label,
  className = '',
  disabled = false,
}) => {
  const { t } = useTaurentTranslation('common');
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {label ?? t('actions.retry')}
    </Button>
  );
});

RetryButton.displayName = 'RetryButton';
