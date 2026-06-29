import React from 'react';

export interface FormSectionTitleProps {
  title: string;
  subtitle?: string;
  className?: string;
}

/**
 * Simple section title for forms.
 * Used to provide consistent section headers across add/login screens.
 */
export const FormSectionTitle: React.FC<FormSectionTitleProps> = React.memo(({
  title,
  subtitle,
  className = '',
}) => {
  return (
    <div className={`mb-4 ${className}`}>
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      {subtitle && (
        <p className="text-sm text-text-secondary mt-1">{subtitle}</p>
      )}
    </div>
  );
});

FormSectionTitle.displayName = 'FormSectionTitle';
