import React, { useState, useEffect, useCallback } from 'react';
import {
  type RemoteSettingsSectionKey,
  type RemoteSettingsField,
  REMOTE_SETTINGS_SECTIONS,
  toUiNumberValue,
  toWireNumberValue,
} from '@taurent/shared/settings';
import { Checkbox } from '../../primitives/Checkbox';
import { cn } from '@taurent/shared';
import { NumberInput } from '../../primitives/NumberInput';
import { Select } from '../../primitives/Select';
import { Input } from '../../primitives/Input';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RemoteSettingsPanelProps {
  /** Which section to render */
  section: RemoteSettingsSectionKey;
  /** Current preferences from the server */
  preferences: Record<string, unknown> | null;
  /** Externally managed staged values (when defined, panel is controlled) */
  stagedValues?: Record<string, unknown>;
  /** Called when user changes a field */
  onStagedChange?: (key: string, value: unknown) => void;
  /** Which field keys are dirty (for per-field highlighting and revert) */
  dirtyKeys?: string[];
  /** Original values to revert to per field (keyed by field key) */
  baselineValues?: Record<string, unknown>;
}

export const RemoteSettingsPanel = React.memo<RemoteSettingsPanelProps>(({
  section,
  preferences,
  stagedValues,
  onStagedChange,
  dirtyKeys,
  baselineValues,
}) => {
  const sectionDef = REMOTE_SETTINGS_SECTIONS[section];
  const fields = sectionDef.desktopFields;

  return (
    <DesktopRemoteSection
      sectionDef={sectionDef}
      fields={fields}
      preferences={preferences}
      stagedValues={stagedValues}
      onStagedChange={onStagedChange}
      dirtyKeys={dirtyKeys}
      baselineValues={baselineValues}
    />
  );
});

RemoteSettingsPanel.displayName = 'RemoteSettingsPanel';

// ─── Desktop panel (internal) ─────────────────────────────────────────────────

interface DesktopRemoteSectionProps {
  sectionDef: {
    title: string;
    description?: string;
    groups?: Array<{ key: string; title: string; description?: string }>;
  };
  fields: RemoteSettingsField[];
  preferences: Record<string, unknown> | null;
  /** When defined, the panel is controlled and uses these values instead of internal staged state */
  stagedValues?: Record<string, unknown>;
  /** Called when user changes a field (used in controlled desktop variant) */
  onStagedChange?: (key: string, value: unknown) => void;
  /** Which field keys are dirty (for per-field highlighting and revert) */
  dirtyKeys?: string[];
  /** Original values to revert to per field (keyed by field key) */
  baselineValues?: Record<string, unknown>;
}

function DesktopRemoteSection({
  sectionDef,
  fields,
  preferences,
  stagedValues,
  onStagedChange,
  dirtyKeys,
  baselineValues,
}: DesktopRemoteSectionProps) {
  const [internalStaged, setInternalStaged] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const field of fields) {
      // Values arrive pre-normalized from Rust — use directly.
      initial[field.key] = preferences?.[field.key];
    }
    return initial;
  });

  useEffect(() => {
    setInternalStaged((prev) => {
      const next: Record<string, unknown> = {};
      for (const field of fields) {
        // Preserve any user-edited value; otherwise use the pre-normalized
        // value directly from the Rust bridge.
        next[field.key] = field.key in prev
          ? prev[field.key]
          : preferences?.[field.key];
      }
      return next;
    });
  }, [preferences, fields]);

  // Use controlled staged values when provided; otherwise fall back to internal state
  const effectiveStaged = stagedValues !== undefined ? stagedValues : internalStaged;
  const isControlled = stagedValues !== undefined;

  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      if (isControlled && onStagedChange) {
        onStagedChange(key, value);
      } else {
        setInternalStaged((prev) => ({ ...prev, [key]: value }));
      }
    },
    [isControlled, onStagedChange],
  );

  const handleFieldRevert = useCallback(
    (key: string) => {
      const baseline = baselineValues?.[key];
      if (baseline !== undefined) {
        handleFieldChange(key, baseline);
      }
    },
    [baselineValues, handleFieldChange],
  );

  const visibleFields = fields.filter((f) => !f.visibleWhen || f.visibleWhen(effectiveStaged));
  const groups = sectionDef.groups;

  return (
    <div className="space-y-4">
      {groups && groups.length > 0 ? (
        groups.map((group) => {
          const groupFields = visibleFields.filter((f) => f.group === group.key);
          if (groupFields.length === 0) return null;
          return (
            <div key={group.key} className="rounded-sm border border-border bg-surface px-2 py-2">
              <p className="mb-2 text-xs font-medium text-text-muted">{group.title}</p>
              {group.description ? (
                <p className="mb-3 text-xs text-text-secondary">{group.description}</p>
              ) : null}
              <div className="space-y-2">
                {groupFields.map((field) => (
                  <DesktopFieldRow
                    key={field.key}
                    field={field}
                    value={effectiveStaged[field.key]}
                    onChange={handleFieldChange}
                    isDirty={dirtyKeys?.includes(field.key)}
                    onRevert={handleFieldRevert}
                  />
                ))}
              </div>
            </div>
          );
        })
      ) : (
        <div className="rounded-sm border border-border bg-surface px-2 py-2">
          {sectionDef.description ? (
            <p className="mb-2 text-xs text-text-secondary">{sectionDef.description}</p>
          ) : null}
          <div className="space-y-2">
            {visibleFields.map((field) => (
              <DesktopFieldRow
                key={field.key}
                field={field}
                value={effectiveStaged[field.key]}
                onChange={handleFieldChange}
                isDirty={dirtyKeys?.includes(field.key)}
                onRevert={handleFieldRevert}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface DesktopFieldRowProps {
  field: RemoteSettingsField;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  isDirty?: boolean;
  onRevert?: (key: string) => void;
}

function DesktopFieldRow({ field, value, onChange, isDirty, onRevert }: DesktopFieldRowProps) {
  const id = `field-${field.key}`;

  if (field.kind === 'boolean') {
    return (
      <DesktopToggle
        label={field.label ?? field.key}
        description={field.description}
        checked={Boolean(value)}
        onChange={(v) => onChange(field.key, v)}
        isDirty={isDirty}
        onRevert={isDirty && onRevert ? () => onRevert(field.key) : undefined}
        fieldKey={field.key}
      />
    );
  }

  if (field.kind === 'number') {
    const handleNumericChange = (nextValue: number) => {
      const uiValue = Number.isFinite(nextValue) ? nextValue : 0;
      onChange(field.key, toWireNumberValue(field, uiValue));
    };

    return (
      <div className="space-y-1">
        <div className={cn(
          'flex items-center gap-3 rounded-sm border border-border px-2 py-2 transition-colors',
          isDirty ? 'border-primary/40 bg-primary/5' : 'bg-background'
        )}>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <label htmlFor={id} className="block text-xs font-medium text-text-secondary">
                {field.label ?? field.key}
              </label>
              {isDirty && <span className="inline-block h-2 w-2 rounded-full bg-primary" />}
            </div>
            {isDirty && onRevert && (
              <button
                type="button"
                onClick={() => onRevert(field.key)}
                className="shrink-0 rounded-sm px-2 py-1 text-xs text-text-muted hover:bg-surface-interactive hover:text-text-primary"
              >
                Revert
              </button>
            )}
          </div>
          <div className={cn('shrink-0', field.mobileEditor?.unitMode ? 'w-48' : 'w-28')}>
            <NumberInput
              id={id}
              value={toUiNumberValue(field, value)}
              unitMode={field.mobileEditor?.unitMode}
              unitDefault={field.mobileEditor?.unitDefault}
              onValueChange={handleNumericChange}
              onChange={(e) => {
                if (!field.mobileEditor?.unitMode) {
                  handleNumericChange(Number.parseFloat(e.target.value) || 0);
                }
              }}
              className={cn(
                'h-8 w-full rounded-sm border border-border bg-background px-2 py-2 text-xs text-text-primary',
                'focus-visible:ring-1 focus-visible:ring-border-focus focus-visible:outline-none'
              )}
            />
          </div>
        </div>
        {field.description ? (
          <p className="pr-3 text-xs text-text-secondary">{field.description}</p>
        ) : null}
      </div>
    );
  }

  if (field.kind === 'unlimitedNumber') {
    const numericValue = toUiNumberValue(field, value);
    const isEnabled = numericValue !== field.disabledValue;
    const inputValue = isEnabled ? numericValue : field.defaultEnabledValue;
    const description = isEnabled
      ? field.description
      : field.description
        ? `${field.description} ${field.disabledLabel}.`
        : field.disabledLabel;

    return (
      <div className="space-y-1">
        <div className={cn(
          'flex items-center gap-3 rounded-sm border border-border px-2 py-2 transition-colors',
          isDirty ? 'border-primary/40 bg-primary/5' : 'bg-background'
        )}>
          <Checkbox
            checked={isEnabled}
            onChange={(checked) => {
              onChange(field.key, checked ? field.defaultEnabledValue : field.disabledValue);
            }}
            dataTestid={`settings-checkbox-${field.key}`}
          />
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <label htmlFor={id} className="block text-xs font-medium text-text-secondary">
                {field.label ?? field.key}
              </label>
              {isDirty && <span className="inline-block h-2 w-2 rounded-full bg-primary" />}
            </div>
            {isDirty && onRevert && (
              <button
                type="button"
                onClick={() => onRevert(field.key)}
                className="shrink-0 rounded-sm px-2 py-1 text-xs text-text-muted hover:bg-surface-interactive hover:text-text-primary"
              >
                Revert
              </button>
            )}
          </div>
          <div className={cn('shrink-0', field.mobileEditor?.unitMode ? 'w-48' : 'w-28')}>
            <NumberInput
              id={id}
              value={inputValue}
              disabled={!isEnabled}
              unitMode={field.mobileEditor?.unitMode}
              unitDefault={field.mobileEditor?.unitDefault}
              onValueChange={(nextValue) => {
                const uiValue = Number.isFinite(nextValue) ? nextValue : field.defaultEnabledValue;
                onChange(field.key, toWireNumberValue(field, uiValue));
              }}
              onChange={(e) => {
                if (!field.mobileEditor?.unitMode) {
                  onChange(field.key, Number.parseFloat(e.target.value) || field.defaultEnabledValue);
                }
              }}
              className={cn(
                'h-8 w-full rounded-sm border border-border bg-background px-2 py-2 text-xs text-text-primary',
                'focus-visible:ring-1 focus-visible:ring-border-focus focus-visible:outline-none'
              )}
            />
          </div>
        </div>
        {description ? (
          <p className="pr-3 text-xs text-text-secondary">{description}</p>
        ) : null}
      </div>
    );
  }

  if (field.kind === 'string') {
    return (
      <div className="space-y-1">
        <div className={cn(
          'flex items-center gap-3 rounded-sm border border-border px-2 py-2 transition-colors',
          isDirty ? 'border-primary/40 bg-primary/5' : 'bg-background'
        )}>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <label htmlFor={id} className="block text-xs font-medium text-text-secondary">
                {field.label ?? field.key}
              </label>
              {isDirty && <span className="inline-block h-2 w-2 rounded-full bg-primary" />}
            </div>
            {isDirty && onRevert && (
              <button
                type="button"
                onClick={() => onRevert(field.key)}
                className="shrink-0 rounded-sm px-2 py-1 text-xs text-text-muted hover:bg-surface-interactive hover:text-text-primary"
              >
                Revert
              </button>
            )}
          </div>
          <div>
            <Input
              id={id}
              type="text"
              value={(value as string) ?? ''}
              onChange={(v) => onChange(field.key, v)}
              className="flex-1 min-w-0 shrink-0"
              size="sm"
            />
          </div>
        </div>
        {field.description ? (
          <p className="pr-3 text-xs text-text-secondary">{field.description}</p>
        ) : null}
      </div>
    );
  }

  if (field.kind === 'textarea') {
    return (
      <div className={cn(
        'rounded-sm border border-border px-2 py-2 transition-colors',
        isDirty ? 'border-primary/40 bg-primary/5' : 'bg-background'
      )}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label htmlFor={id} className="flex items-center gap-2 text-xs font-medium text-text-secondary">
            {field.label ?? field.key}
            {isDirty && <span className="inline-block h-2 w-2 rounded-full bg-primary" />}
          </label>
          {isDirty && onRevert && (
            <button
              type="button"
              onClick={() => onRevert(field.key)}
              className="shrink-0 rounded-sm px-2 py-1 text-xs text-text-muted hover:bg-surface-interactive hover:text-text-primary"
            >
              Revert
            </button>
          )}
        </div>
        <textarea
          id={id}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(field.key, e.target.value)}
          rows={3}
          className={cn(
            'w-full rounded-sm border border-border bg-background px-2 py-2 text-sm text-text-primary',
            'focus-visible:ring-1 focus-visible:ring-border-focus focus-visible:outline-none'
          )}
        />
        {field.description ? (
          <p className="mt-1 text-xs text-text-secondary">{field.description}</p>
        ) : null}
      </div>
    );
  }

  if (field.kind === 'select') {
    return (
      <div className="space-y-1">
        <div className={cn(
          'flex items-center gap-3 rounded-sm border border-border px-2 py-2 transition-colors',
          isDirty ? 'border-primary/40 bg-primary/5' : 'bg-background'
        )}>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <label htmlFor={id} className="block text-xs font-medium text-text-secondary">
                {field.label ?? field.key}
              </label>
              {isDirty && <span className="inline-block h-2 w-2 rounded-full bg-primary" />}
            </div>
            {isDirty && onRevert && (
              <button
                type="button"
                onClick={() => onRevert(field.key)}
                className="shrink-0 rounded-sm px-2 py-1 text-xs text-text-muted hover:bg-surface-interactive hover:text-text-primary"
              >
                Revert
              </button>
            )}
          </div>
          <Select
            id={id}
            value={value as (number | string) | undefined}
            options={field.selectOptions.map(opt => ({ value: opt.value, label: opt.label }))}
            onChange={(value) => onChange(field.key, value)}
            label={undefined}
            className="w-32 h-8 px-2 text-xs"
            containerClassName="shrink-0"
            alignment="right"
          />
        </div>
        {field.description ? (
          <p className="pr-3 text-xs text-text-secondary">{field.description}</p>
        ) : null}
      </div>
    );
  }

  return null;
}

function DesktopToggle({
  label,
  description,
  checked,
  onChange,
  isDirty,
  onRevert,
  fieldKey,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  isDirty?: boolean;
  onRevert?: () => void;
  fieldKey?: string;
}) {
  const toggleId = fieldKey ? `settings-toggle-${fieldKey}` : undefined;
  return (
    <div
      data-testid={toggleId}
      className={cn(
        'flex gap-3 rounded-sm border border-border px-2 py-2 transition-colors hover:border-border-focus',
        isDirty
          ? 'border-primary/40 bg-primary/5'
          : 'bg-background',
        description ? 'items-start' : 'items-center'
      )}
    >
      <div className={cn(description ? 'pt-1' : 'pt-0')}>
        <Checkbox checked={checked} onChange={onChange} dataTestid={fieldKey ? `settings-checkbox-${fieldKey}` : undefined} />
      </div>
      <div className="flex flex-1 items-center justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="text-xs font-medium text-text-primary">{label}</div>
            {isDirty && (
              <span className="inline-block h-2 w-2 rounded-full bg-primary" />
            )}
          </div>
          {description ? <div className="mt-1 text-xs text-text-secondary">{description}</div> : null}
        </div>
        {isDirty && onRevert && (
          <button
            type="button"
            onClick={onRevert}
            className="shrink-0 rounded-sm px-2 py-1 text-xs text-text-muted hover:bg-surface-interactive hover:text-text-primary"
          >
            Revert
          </button>
        )}
      </div>
    </div>
  );
}
