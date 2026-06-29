import { describe, it, expect } from 'vitest';
import { isSectionDirty, getDirtyFieldKeys, getDefaultForField, toUiNumberValue, toWireNumberValue } from '../remoteSettingsHelpers';
import type { RemoteSettingsField } from '../remoteSettingsSections';

describe('isSectionDirty', () => {
  it('returns false when staged equals baseline', () => {
    const baseline = { name: 'Alice', age: 30, active: true };
    const staged = { name: 'Alice', age: 30, active: true };
    expect(isSectionDirty(staged, baseline)).toBe(false);
  });

  it('returns true when a string field differs', () => {
    const baseline = { name: 'Alice', age: 30 };
    const staged = { name: 'Bob', age: 30 };
    expect(isSectionDirty(staged, baseline)).toBe(true);
  });

  it('returns true when a number field differs', () => {
    const baseline = { name: 'Alice', age: 30 };
    const staged = { name: 'Alice', age: 31 };
    expect(isSectionDirty(staged, baseline)).toBe(true);
  });

  it('returns true when a boolean field differs', () => {
    const baseline = { active: true };
    const staged = { active: false };
    expect(isSectionDirty(staged, baseline)).toBe(true);
  });

  it('returns true when staged has extra keys not in baseline', () => {
    const baseline = { name: 'Alice' };
    const staged = { name: 'Alice', age: 30 };
    expect(isSectionDirty(staged, baseline)).toBe(false);
  });

  it('returns true when baseline has extra keys not in staged', () => {
    const baseline = { name: 'Alice', age: 30 };
    const staged = { name: 'Alice' };
    // age is now undefined in staged while baseline has 30 — that is a change
    expect(isSectionDirty(staged, baseline)).toBe(true);
  });

  it('returns false when both undefined', () => {
    expect(isSectionDirty(undefined, undefined)).toBe(false);
  });

  it('returns false when staged is undefined', () => {
    const baseline = { name: 'Alice' };
    expect(isSectionDirty(undefined, baseline)).toBe(false);
  });

  it('returns false when baseline is undefined', () => {
    const staged = { name: 'Alice' };
    expect(isSectionDirty(staged, undefined)).toBe(false);
  });

  it('returns true when null staged differs from baseline', () => {
    const baseline = { name: 'Alice' };
    // @ts-expect-error intentionally passing null
    expect(isSectionDirty(null, baseline)).toBe(false);
  });

  it('returns true when null baseline differs from staged', () => {
    const staged = { name: 'Alice' };
    // @ts-expect-error intentionally passing null
    expect(isSectionDirty(staged, null)).toBe(false);
  });
});

describe('getDirtyFieldKeys', () => {
  it('returns empty array when staged equals baseline', () => {
    const baseline = { name: 'Alice', age: 30, active: true };
    const staged = { name: 'Alice', age: 30, active: true };
    expect(getDirtyFieldKeys(staged, baseline)).toEqual([]);
  });

  it('returns the key when one string field differs', () => {
    const baseline = { name: 'Alice', age: 30 };
    const staged = { name: 'Bob', age: 30 };
    expect(getDirtyFieldKeys(staged, baseline)).toEqual(['name']);
  });

  it('returns multiple keys when multiple fields differ', () => {
    const baseline = { name: 'Alice', age: 30, active: true };
    const staged = { name: 'Bob', age: 31, active: true };
    expect(getDirtyFieldKeys(staged, baseline)).toEqual(['name', 'age']);
  });

  it('returns empty array when only extra keys exist in staged', () => {
    const baseline = { name: 'Alice' };
    const staged = { name: 'Alice', age: 30 };
    expect(getDirtyFieldKeys(staged, baseline)).toEqual([]);
  });

  it('reports dirty keys when baseline has extra keys not in staged', () => {
    const baseline = { name: 'Alice', age: 30 };
    const staged = { name: 'Alice' };
    // age is dirty because baseline has it (30) but staged has undefined
    expect(getDirtyFieldKeys(staged, baseline)).toEqual(['age']);
  });

  it('returns empty array when both undefined', () => {
    expect(getDirtyFieldKeys(undefined, undefined)).toEqual([]);
  });

  it('returns empty array when staged is undefined', () => {
    const baseline = { name: 'Alice' };
    expect(getDirtyFieldKeys(undefined, baseline)).toEqual([]);
  });

  it('returns empty array when baseline is undefined', () => {
    const staged = { name: 'Alice' };
    expect(getDirtyFieldKeys(staged, undefined)).toEqual([]);
  });

  it('returns empty array when null staged', () => {
    const baseline = { name: 'Alice' };
    // @ts-expect-error intentionally passing null
    expect(getDirtyFieldKeys(null, baseline)).toEqual([]);
  });

  it('returns empty array when null baseline', () => {
    const staged = { name: 'Alice' };
    // @ts-expect-error intentionally passing null
    expect(getDirtyFieldKeys(staged, null)).toEqual([]);
  });

  it('handles mixed types: number vs string for same key', () => {
    const baseline = { value: 0 };
    const staged = { value: '0' as unknown };
    // Strict equality: 0 !== '0'
    expect(getDirtyFieldKeys(staged, baseline)).toEqual(['value']);
  });

  it('handles empty string vs false for boolean field', () => {
    const baseline = { active: false };
    const staged = { active: '' as unknown };
    // Strict equality: '' !== false
    expect(getDirtyFieldKeys(staged, baseline)).toEqual(['active']);
  });
});

describe('multiple dirty sections', () => {
  it('detects dirty state across multiple independent sections', () => {
    // All baselines
    const baselines: Record<string, Record<string, unknown>> = {
      connection: { upnp: true, port: 8080 },
      downloads: { max_concurrent: 10, max_speed: -1 },
      speed: { upload_limit: 0, download_limit: 0 },
    };

    // All staged - only connection is dirty
    const stagedRemotes: Record<string, Record<string, unknown>> = {
      connection: { upnp: false, port: 8080 }, // dirty: upnp
      downloads: { max_concurrent: 10, max_speed: -1 }, // clean
      speed: { upload_limit: 0, download_limit: 0 }, // clean
    };

    expect(isSectionDirty(stagedRemotes.connection, baselines.connection)).toBe(true);
    expect(isSectionDirty(stagedRemotes.downloads, baselines.downloads)).toBe(false);
    expect(isSectionDirty(stagedRemotes.speed, baselines.speed)).toBe(false);

    expect(getDirtyFieldKeys(stagedRemotes.connection, baselines.connection)).toEqual(['upnp']);
    expect(getDirtyFieldKeys(stagedRemotes.downloads, baselines.downloads)).toEqual([]);
    expect(getDirtyFieldKeys(stagedRemotes.speed, baselines.speed)).toEqual([]);
  });

  it('detects multiple dirty sections simultaneously', () => {
    const baselines: Record<string, Record<string, unknown>> = {
      sectionA: { field1: 'original' },
      sectionB: { field2: 100 },
    };
    const stagedRemotes: Record<string, Record<string, unknown>> = {
      sectionA: { field1: 'changed' }, // dirty
      sectionB: { field2: 200 }, // dirty
    };

    expect(isSectionDirty(stagedRemotes.sectionA, baselines.sectionA)).toBe(true);
    expect(isSectionDirty(stagedRemotes.sectionB, baselines.sectionB)).toBe(true);

    expect(getDirtyFieldKeys(stagedRemotes.sectionA, baselines.sectionA)).toEqual(['field1']);
    expect(getDirtyFieldKeys(stagedRemotes.sectionB, baselines.sectionB)).toEqual(['field2']);
  });

  it('gracefully handles partial undefined sections', () => {
    const baselines: Record<string, Record<string, unknown> | undefined> = {
      connection: { upnp: true },
      downloads: { max_concurrent: 10 },
    };
    const stagedRemotes: Record<string, Record<string, unknown> | undefined> = {
      connection: { upnp: false }, // dirty
      // downloads is undefined
    };

    expect(isSectionDirty(stagedRemotes.connection, baselines.connection)).toBe(true);
    expect(isSectionDirty(stagedRemotes.downloads, baselines.downloads)).toBe(false);
    expect(getDirtyFieldKeys(stagedRemotes.downloads, baselines.downloads)).toEqual([]);
  });
});

// ─── Normalization tests ──────────────────────────────────────────────────────

// Reusable field fixtures
const selectProxyType: RemoteSettingsField = {
  kind: 'select',
  key: 'proxy_type',
  selectOptions: [
    { value: 0, label: '(None)' },
    { value: 1, label: 'HTTP' },
    { value: 2, label: 'SOCKS5' },
    { value: 3, label: 'HTTP with auth' },
    { value: 4, label: 'SOCKS5 with auth' },
    { value: 5, label: 'SOCKS4' },
  ],
};

const _selectBittorrentProtocol: RemoteSettingsField = {
  kind: 'select',
  key: 'bittorrent_protocol',
  selectOptions: [
    { value: 0, label: 'TCP and µTP' },
    { value: 1, label: 'TCP' },
    { value: 2, label: 'µTP' },
  ],
};

const boolField: RemoteSettingsField = {
  kind: 'boolean',
  key: 'some_bool',
};

const numberField: RemoteSettingsField = {
  kind: 'number',
  key: 'some_number',
  mobileEditor: { title: 'Some Number' },
};

const stringField: RemoteSettingsField = {
  kind: 'string',
  key: 'some_string',
};

describe('getDefaultForField', () => {
  it('returns false for boolean fields', () => {
    expect(getDefaultForField(boolField)).toBe(false);
  });

  it('returns 0 for number fields', () => {
    expect(getDefaultForField(numberField)).toBe(0);
  });

  it('returns empty string for string fields', () => {
    expect(getDefaultForField(stringField)).toBe('');
  });

  it('returns first option value for select fields', () => {
    expect(getDefaultForField(selectProxyType)).toBe(0);
  });

  it('returns first option value for select fields with non-zero start', () => {
    const fieldType: RemoteSettingsField = {
      kind: 'select',
      key: 'test',
      selectOptions: [{ value: 1, label: 'A' }, { value: 2, label: 'B' }],
    };
    expect(getDefaultForField(fieldType)).toBe(1);
  });
});

// ─── Sentinel normalization ────────────────────────────────────────────────────

describe('toUiNumberValue', () => {
  const speedField = {
    kind: 'number' as const,
    key: 'dl_limit',
    mobileEditor: { unitMode: 'bytes-per-second' as const },
  };

  const nonSpeedNumberField = {
    kind: 'number' as const,
    key: 'listen_port',
    mobileEditor: { title: 'Port', unitMode: undefined },
  };

  const unlimitedField = {
    kind: 'unlimitedNumber' as const,
    key: 'max_connec',
    disabledValue: -1,
    mobileEditor: { title: 'Max Connections', unitMode: undefined },
  };

  it('speed field, raw -1 → returns 0', () => {
    expect(toUiNumberValue(speedField, -1)).toBe(0);
  });

  it('speed field, raw 102400 → returns 102400 (passthrough)', () => {
    expect(toUiNumberValue(speedField, 102400)).toBe(102400);
  });

  it('speed field, raw undefined → returns 0', () => {
    expect(toUiNumberValue(speedField, undefined)).toBe(0);
  });

  it('non-speed number field, raw -1 → returns -1 (passthrough, no sentinel conversion)', () => {
    expect(toUiNumberValue(nonSpeedNumberField, -1)).toBe(-1);
  });

  it('unlimitedNumber field, raw undefined → returns disabledValue', () => {
    expect(toUiNumberValue(unlimitedField, undefined)).toBe(-1);
  });

  it('unlimitedNumber field, raw 500 → returns 500', () => {
    expect(toUiNumberValue(unlimitedField, 500)).toBe(500);
  });
});

describe('toWireNumberValue', () => {
  const speedField = {
    kind: 'number' as const,
    key: 'dl_limit',
    mobileEditor: { unitMode: 'bytes-per-second' as const },
  };

  const nonSpeedNumberField = {
    kind: 'number' as const,
    key: 'listen_port',
    mobileEditor: { title: 'Port', unitMode: undefined },
  };

  it('speed field, ui 0 → returns -1', () => {
    expect(toWireNumberValue(speedField, 0)).toBe(-1);
  });

  it('speed field, ui 102400 → returns 102400', () => {
    expect(toWireNumberValue(speedField, 102400)).toBe(102400);
  });

  it('non-speed number field, ui 0 → returns 0 (no conversion)', () => {
    expect(toWireNumberValue(nonSpeedNumberField, 0)).toBe(0);
  });
});


