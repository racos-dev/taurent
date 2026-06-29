import type { RemoteSettingsField } from './remoteSettingsSections';

/**
 * Return the default value for a field type (used when the server value is
 * null/undefined or unrecognized).
 */
export function getDefaultForField(field: RemoteSettingsField): unknown {
  switch (field.kind) {
    case 'boolean':
      return false;
    case 'number':
      return 0;
    case 'unlimitedNumber':
      return field.disabledValue;
    case 'string':
    case 'textarea':
      return '';
    case 'select':
      return field.selectOptions[0]?.value ?? 0;
    default:
      return false;
  }
}

/**
 * Normalize a raw value from the wire for display in the UI.
 *
 * Speed fields (`kind: 'number'`, `unitMode: 'bytes-per-second'`):
 * qBittorrent uses -1 for unlimited → UI uses 0.
 *
 * UnlimitedNumber fields: raw undefined/null → disabledValue.
 *
 * Everything else is passed through as-is.
 */
export function toUiNumberValue(
  field: { kind: string; mobileEditor?: { unitMode?: string }; disabledValue?: number },
  raw: unknown,
): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    if (field.kind === 'unlimitedNumber') {
      return field.disabledValue ?? -1;
    }
    return 0;
  }
  // Speed fields: qBittorrent uses -1 for "unlimited"; UI uses 0.
  if (field.kind === 'number' && field.mobileEditor?.unitMode === 'bytes-per-second' && raw < 0) {
    return 0;
  }
  return raw;
}

/**
 * Normalize a UI value back to the wire format.
 *
 * Speed fields (`kind: 'number'`, `unitMode: 'bytes-per-second'`):
 * 0 in the UI means unlimited → -1 on the wire.
 *
 * Everything else is passed through as-is.
 */
export function toWireNumberValue(
  field: { kind: string; mobileEditor?: { unitMode?: string } },
  ui: number,
): number {
  // Speed fields: 0 in UI means unlimited → -1 on the wire.
  if (field.kind === 'number' && field.mobileEditor?.unitMode === 'bytes-per-second' && ui === 0) {
    return -1;
  }
  return ui;
}

/**
 * Check if two section snapshots differ.
 *
 * Returns false if either argument is undefined/null (handles the initial
 * uninitialized state where no baseline has been loaded yet).
 */
export function isSectionDirty(
  staged: Record<string, unknown> | undefined,
  baseline: Record<string, unknown> | undefined,
): boolean {
  if (!staged || !baseline) return false;
  for (const key of Object.keys(baseline)) {
    if (staged[key] !== baseline[key]) return true;
  }
  return false;
}

/**
 * Get list of changed field keys in a section.
 *
 * Returns an empty array if either argument is undefined/null (handles the
 * initial uninitialized state gracefully).
 */
export function getDirtyFieldKeys(
  staged: Record<string, unknown> | undefined,
  baseline: Record<string, unknown> | undefined,
): string[] {
  if (!staged || !baseline) return [];
  const keys: string[] = [];
  for (const key of Object.keys(baseline)) {
    if (staged[key] !== baseline[key]) keys.push(key);
  }
  return keys;
}
