import React from 'react';
import type { CardWebProps, CardVariant, CardPadding, CardRadius } from './types';

const variantStyles: Record<CardVariant, string> = {
  elevated: 'bg-surface border border-border',
  outline: 'bg-surface border border-border',
  flat: 'bg-surface',
};

const paddingStyles: Record<CardPadding, string> = {
  none: '',
  sm: 'p-2',
  md: 'p-3',
  lg: 'p-4',
};

const radiusStyles: Record<CardRadius, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-sm',
  lg: 'rounded-sm',
  xl: 'rounded-sm',
  full: 'rounded-full',
};

export const Card: React.FC<CardWebProps> = React.memo(({
  variant = 'elevated',
  padding = 'md',
  radius = 'lg',
  onClick,
  className = '',
  children,
}) => {
  const cardStyles = `
    ${variantStyles[variant]}
    ${paddingStyles[padding]}
    ${radiusStyles[radius]}
    ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}
    ${className}
  `.trim();

  if (onClick) {
    return (
      <div
        onClick={onClick}
        className={cardStyles}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onClick();
          }
        }}
      >
        {children}
      </div>
    );
  }

  return <div className={cardStyles}>{children}</div>;
});

Card.displayName = 'Card';
