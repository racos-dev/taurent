// Mobile SettingsScreen route. Business logic and state orchestration stay in
// web-core hooks; mobile owns a focused settings presentation that avoids the
// desktop-style accordion body.

import { useQBClient } from '../connection/QBClientProvider';
import { useServerManager } from '../connection/ServerManager';
import { usePreferences, useSetPreferences, useToggleSpeedLimitsMode } from '../hooks/useSettings';
import type { RemoteSettingsSectionKey } from '@taurent/shared/settings';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';
import { useTheme } from '@taurent/web-ui/theme';
import {
  findRemoteSettingsSectionForField,
  useRemoteSettingsDraft,
  useSettingsScreenController,
} from '@taurent/web-core/screens';
import { StateCard } from '@taurent/web-ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { mobileCenteredStateClassName } from '../ui/mobileScreenLayout';
import { MobileSettingsScreenBody } from './MobileSettingsScreenBody';

const MOBILE_REMOTE_SECTION_KEYS: RemoteSettingsSectionKey[] = [
  'downloads',
  'connection',
  'speed',
  'bittorrent',
  'webui',
  'advanced',
];

export function SettingsScreen() {
  const navigate = useNavigate();
  const { isConnected, isHydrated, serverId, serverName, serverUrl, disconnect } = useQBClient();
  const { servers, removeServer, updateServer, switchServer } = useServerManager();
  const { preferences, isLoading, error, refetch } = usePreferences();
  const setPreferencesMutation = useSetPreferences();
  const { config, setMode, setSystemPalette, setManualPalette, setManualVariant, setAccent } = useTheme();

  const { toggleSpeedLimitsMode } = useToggleSpeedLimitsMode();
  const openServerPicker = useCallback(() => navigate('/manage-servers'), [navigate]);

  const [remoteSaveError, setRemoteSaveError] = useState<string | null>(null);
  const [isSavingRemote, setIsSavingRemote] = useState(false);
  const remoteDraft = useRemoteSettingsDraft({
    preferences: preferences ?? null,
    serverId,
    sectionKeys: MOBILE_REMOTE_SECTION_KEYS,
  });

  useEffect(() => {
    setRemoteSaveError(null);
  }, [serverId]);

  const handleRemoteStagedChange = useCallback((section: RemoteSettingsSectionKey, key: string, value: unknown) => {
    remoteDraft.setFieldValue(section, key, value);
    setRemoteSaveError(null);
  }, [remoteDraft]);

  const handlePreferenceStage = useCallback((key: string, value: boolean | number | string) => {
    const section = findRemoteSettingsSectionForField(key, MOBILE_REMOTE_SECTION_KEYS);
    if (!section) return;
    handleRemoteStagedChange(section, key, value);
  }, [handleRemoteStagedChange]);

  const handleSaveAllRemote = useCallback(async () => {
    const updates = remoteDraft.buildUpdates();
    if (Object.keys(updates).length === 0) return;

    setIsSavingRemote(true);
    setRemoteSaveError(null);

    try {
      await setPreferencesMutation.mutateAsync(updates);
      remoteDraft.markSaved();
    } catch (err) {
      setRemoteSaveError(formatUserMessageForContext(err, 'settings-save'));
    } finally {
      setIsSavingRemote(false);
    }
  }, [remoteDraft, setPreferencesMutation]);

  const handleDiscardAllRemote = useCallback(() => {
    remoteDraft.discard();
    setRemoteSaveError(null);
  }, [remoteDraft]);

  const controller = useSettingsScreenController({
    serverState: { isConnected, serverId, serverName, serverUrl },
    servers,
    updatePreference: handlePreferenceStage,
    removeServer,
    updateServer,
    switchServer,
    disconnect,
    config,
    onNavigateToLogin: () => navigate('/servers', { replace: true }),
    onNavigateToHome: () => navigate('/', { replace: true }),
    toggleSpeedLimitsMode,
  });

  const mobileSectionSummaries = useMemo(
    () => ({
      speed: controller.sectionSummaries.speed,
      connection: controller.sectionSummaries.connection,
      downloads: controller.sectionSummaries.downloads,
      bittorrent: controller.sectionSummaries.bittorrent,
      webui: controller.sectionSummaries.webui,
      advanced: controller.sectionSummaries.advanced,
    }),
    [controller.sectionSummaries]
  );

  if (!isHydrated) {
    return (
      <div className={mobileCenteredStateClassName({ height: 'full' })}>
        <StateCard
          title="Loading settings"
          message="Preparing your saved server and appearance settings."
          icon={<Icon name="settings" iconSize="lg" />}
        />
      </div>
    );
  }

  return (
    <MobileSettingsScreenBody
        connection={{ isConnected, serverName, serverUrl }}
        servers={servers}
        serverId={serverId}
        preferences={preferences ?? null}
        effectivePreferences={remoteDraft.effectivePreferences as Record<string, unknown> | null}
        isLoading={isLoading}
        error={error ? formatUserMessageForContext(error, 'settings-load') : null}
        onRetry={refetch}
        themeSummary={controller.themeSummary}
        sectionSummaries={mobileSectionSummaries}
        themeConfig={{
          mode: config.mode,
          systemPalette: config.systemPalette,
          manualPalette: config.manualPalette,
          manualVariant: config.manualVariant,
          accent: config.accent,
        }}
        onThemeModeChange={setMode}
        onSystemPaletteChange={setSystemPalette}
        onManualPaletteChange={setManualPalette}
        onManualVariantChange={setManualVariant}
        onAccentChange={setAccent}
        stagedValues={remoteDraft.stagedValues}
        baselineValues={remoteDraft.baselineValues}
        dirtyKeys={remoteDraft.dirtyKeys}
        isRemoteDirty={remoteDraft.isDirty}
        isSavingRemote={isSavingRemote}
        remoteSaveError={remoteSaveError}
        onRemoteFieldChange={handleRemoteStagedChange}
        onSaveRemote={() => void handleSaveAllRemote()}
        onDiscardRemote={handleDiscardAllRemote}
        onOpenServerSwitcher={openServerPicker}
        onOpenStatistics={() => navigate('/statistics')}
        confirmDialog={controller.confirmDialog}
        onCloseConfirmDialog={controller.closeConfirmDialog}
      />
  );
}
