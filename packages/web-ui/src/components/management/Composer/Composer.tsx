import React from 'react';
import { Button } from '../../primitives/Button';
import { Input } from '../../primitives/Input';
import type { ComposerProps } from './types';

export const Composer = React.memo<ComposerProps>(({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
  isPending,
  submitLabel = 'Add',
  cancelLabel = 'Cancel',
}) => {
  return (
    <div className="flex flex-col gap-2 px-2 py-2">
      <Input
        type="text"
        size="sm"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) onSubmit();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="flex-1"
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onSubmit}
          disabled={!value.trim() || isPending}
          className="flex-1"
        >
          {isPending ? 'Adding...' : submitLabel}
        </Button>
      </div>
    </div>
  );
});

Composer.displayName = 'Composer';
