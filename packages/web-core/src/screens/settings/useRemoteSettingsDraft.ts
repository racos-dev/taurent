import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Preferences } from '@taurent/shared';
import {
  type RemoteSettingsSectionKey,
  REMOTE_SETTINGS_SECTIONS,
  getDirtyFieldKeys,
  isSectionDirty,
} from '@taurent/shared/settings';

export type RemoteSettingsSnapshots = Partial<Record<RemoteSettingsSectionKey, Record<string, unknown>>>;

interface UseRemoteSettingsDraftOptions {
  preferences: Preferences | null;
  serverId: string | null;
  sectionKeys: readonly RemoteSettingsSectionKey[];
}

export function buildRemoteSettingsSectionSnapshot(
  sectionKey: RemoteSettingsSectionKey,
  prefs: Record<string, unknown> | null,
): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};

  for (const field of REMOTE_SETTINGS_SECTIONS[sectionKey].desktopFields) {
    snapshot[field.key] = (prefs ?? {})[field.key];
  }

  return snapshot;
}

export function buildRemoteSettingsSnapshots(
  prefs: Preferences | null,
  sectionKeys: readonly RemoteSettingsSectionKey[],
): RemoteSettingsSnapshots {
  const source = prefs as unknown as Record<string, unknown> | null;
  const snapshots: RemoteSettingsSnapshots = {};

  for (const section of sectionKeys) {
    snapshots[section] = buildRemoteSettingsSectionSnapshot(section, source);
  }

  return snapshots;
}

export function buildRemoteSettingsUpdatePayload(
  stagedValues: RemoteSettingsSnapshots,
  baselineValues: RemoteSettingsSnapshots,
  sectionKeys: readonly RemoteSettingsSectionKey[],
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  for (const section of sectionKeys) {
    const staged = stagedValues[section];
    const base = baselineValues[section];
    if (!staged || !base) continue;

    for (const key of getDirtyFieldKeys(staged, base)) {
      updates[key] = staged[key];
    }
  }

  return updates;
}

export function findRemoteSettingsSectionForField(
  key: string,
  sectionKeys: readonly RemoteSettingsSectionKey[],
): RemoteSettingsSectionKey | null {
  for (const section of sectionKeys) {
    if (REMOTE_SETTINGS_SECTIONS[section].desktopFields.some((field) => field.key === key)) {
      return section;
    }
  }

  return null;
}

export function useRemoteSettingsDraft({
  preferences,
  serverId,
  sectionKeys,
}: UseRemoteSettingsDraftOptions) {
  const [baselineValues, setBaselineValues] = useState<RemoteSettingsSnapshots>({});
  const [stagedValues, setStagedValues] = useState<RemoteSettingsSnapshots>({});
  const lastLoadedServerIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    lastLoadedServerIdRef.current = undefined;
  }, [serverId]);

  useEffect(() => {
    if (!preferences) return;

    const snapshots = buildRemoteSettingsSnapshots(preferences, sectionKeys);
    const isServerSwitch = lastLoadedServerIdRef.current !== serverId;
    lastLoadedServerIdRef.current = serverId;

    setBaselineValues(snapshots);

    if (isServerSwitch) {
      setStagedValues(snapshots);
      return;
    }

    setStagedValues((previous) => {
      const next: RemoteSettingsSnapshots = { ...snapshots };
      for (const section of sectionKeys) {
        if (isSectionDirty(previous[section], snapshots[section])) {
          next[section] = previous[section];
        }
      }
      return next;
    });
  }, [preferences, sectionKeys, serverId]);

  const setFieldValue = useCallback((section: RemoteSettingsSectionKey, key: string, value: unknown) => {
    setStagedValues((previous) => ({
      ...previous,
      [section]: {
        ...(previous[section] ?? {}),
        [key]: value,
      },
    }));
  }, []);

  const dirtyKeys = useMemo(() => {
    const result: Partial<Record<RemoteSettingsSectionKey, string[]>> = {};

    for (const section of sectionKeys) {
      result[section] = getDirtyFieldKeys(stagedValues[section], baselineValues[section]);
    }

    return result;
  }, [baselineValues, sectionKeys, stagedValues]);

  const isDirty = useMemo(
    () => Object.values(dirtyKeys).some((keys) => (keys?.length ?? 0) > 0),
    [dirtyKeys],
  );

  const buildUpdates = useCallback(
    () => buildRemoteSettingsUpdatePayload(stagedValues, baselineValues, sectionKeys),
    [baselineValues, sectionKeys, stagedValues],
  );

  const markSaved = useCallback(() => {
    setBaselineValues({ ...stagedValues });
  }, [stagedValues]);

  const discard = useCallback(() => {
    setStagedValues({ ...baselineValues });
  }, [baselineValues]);

  const effectivePreferences = useMemo((): Preferences | null => {
    if (!preferences) return null;

    const merged = { ...preferences };
    for (const section of sectionKeys) {
      const staged = stagedValues[section];
      if (staged) {
        Object.assign(merged, staged);
      }
    }

    return merged;
  }, [preferences, sectionKeys, stagedValues]);

  return {
    baselineValues,
    stagedValues,
    dirtyKeys,
    isDirty,
    effectivePreferences,
    setFieldValue,
    buildUpdates,
    markSaved,
    discard,
  };
}
