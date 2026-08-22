import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  invalidatePreferences,
  RESOURCE,
} from '@taurent/web-core/query';
import { useRemoteSettingsDraft } from '@taurent/web-core/screens';
import { useDeleteAddedTorrentFilesPreference } from '@taurent/web-core/hooks';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LanguageSettingsPanel, RemoteSettingsPanel, RetryButton } from '@taurent/web-ui';
import { SkeletonBlock } from '@taurent/web-ui/components/shared/SkeletonBlock/SkeletonBlock';
import { useQBClient } from '../connection';
import { usePreferences, useSetPreferences, useToggleSpeedLimitsMode } from '../hooks/settings/useSettings';
import { useDesktopWindowSettings } from '../hooks/settings/useDesktopWindowSettings';
import { WindowBehaviorSettings } from '../components/Settings/WindowBehaviorSettings';
import { TaurentDownloadsSettings } from '../components/Settings/TaurentDownloadsSettings';
import { DesktopThemeSettings } from '../components/Settings/DesktopThemeSettings';
import { DesktopAboutSettings } from '../components/Settings/DesktopAboutSettings';
import { ServerOverviewSettings } from '../components/Settings/ServerOverviewSettings';
import { PathMappingsSettings } from '../components/Settings/PathMappingsSettings';
import { emitResourceInvalidated } from '../windows/settings/settingsWindow';
import { SettingsCloseOverlay } from '../components/SettingsCloseOverlay';
import { setScrollToSectionRef, setupScrollToSectionListener } from '../windows/settings/settingsWindow';
import { SettingsSidebar } from '../components/Settings/SettingsSidebar';
import {
  type SectionId,
  type SettingsNavGroup,
  REMOTE_SECTION_NAV,
  APP_NAV_ITEMS,
} from '../components/Settings/SettingsNavConfig';
import {
  type RemoteSettingsSectionKey,
} from '@taurent/shared/settings';
import { localization, useLocalizedErrorFormatter, useTaurentTranslation } from '@taurent/shared/i18n';
import { storage } from '../platform';

const REMOTE_SECTION_KEYS = REMOTE_SECTION_NAV.map((nav) => nav.key);

// ─── Component ─────────────────────────────────────────────────────────────

export function SettingsScreen() {
  const { t } = useTaurentTranslation('settings');
  const formatError = useLocalizedErrorFormatter();
  const queryClient = useQueryClient();
  const { isConnecting, isConnected, isHydrated, sessionGeneration, serverId, error: qbClientError } = useQBClient();

  const {
    preferences,
    error: remotePreferencesError,
    isLoading: isRemotePreferencesQueryLoading,
    refetch: refetchRemotePreferences,
  } = usePreferences();

  const setPreferencesMutation = useSetPreferences();
  const toggleAltSpeedMutation = useToggleSpeedLimitsMode();


  const {
    localSettings,
    isLocalSettingsLoading,
    localSettingsError,
    loadLocalSettings,
    handleSettingChange,
  } = useDesktopWindowSettings();
  const localTorrentFilePreference = useDeleteAddedTorrentFilesPreference(storage);

  // ─── Scroll anchoring ───────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('desktop-window');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const isScrollingTo = useRef(false);

  const setSectionRef = useCallback((id: string) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  }, []);

  const scrollToSection = useCallback((id: SectionId) => {
    const el = sectionRefs.current[id];
    if (el && scrollRef.current) {
      isScrollingTo.current = true;
      setActiveSection(id);
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => { isScrollingTo.current = false; }, 600);
    }
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isScrollingTo.current) return;
      const containerRect = container.getBoundingClientRect();
      // Activation line at 38% down from the top of the scroll container.
      // Select the last section whose top edge is above this line.
      const activationLine = containerRect.top + containerRect.height * 0.38;
      let activeId: string | null = null;

      for (const [id, el] of Object.entries(sectionRefs.current)) {
        if (!el) continue;
        if (el.getBoundingClientRect().top <= activationLine) {
          activeId = id;
        }
      }

      if (activeId) {
        setActiveSection(activeId as SectionId);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Deep-link support
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const section = searchParams.get('section');
    if (section) {
      requestAnimationFrame(() => scrollToSection(section as SectionId));
    }
  }, [searchParams, scrollToSection]);

  // ─── Tauri scroll-to-section event listener ─────────────────────────────
  // Allows the main window to scroll an already-open Settings window to a section
  // (no URL change needed, fixing the race condition for already-open windows).
  useEffect(() => {
    // Register scrollToSection so settingsWindow can call it via Tauri events
    // scrollToSection takes SectionId but listener emits string — the cast is safe
    // because the emitted values always match valid SectionId literals.
    setScrollToSectionRef(scrollToSection as (section: string) => void);
    const unlisten = setupScrollToSectionListener();
    return () => {
      unlisten();
      setScrollToSectionRef(null);
    };
  }, [scrollToSection]);

  // ─── Global save state ──────────────────────────────────────────────────
  const [globalSaveError, setGlobalSaveError] = useState<unknown | null>(null);
  const [isSavingGlobal, setIsSavingGlobal] = useState(false);

  const remoteDraft = useRemoteSettingsDraft({
    preferences: preferences ?? null,
    serverId,
    sectionKeys: REMOTE_SECTION_KEYS,
  });

  useEffect(() => {
    setGlobalSaveError(null);
  }, [serverId]);

  const handleRemoteStagedChange = useCallback((sectionKey: RemoteSettingsSectionKey, fieldKey: string, value: unknown) => {
    remoteDraft.setFieldValue(sectionKey, fieldKey, value);
    // Clear any prior save error so stale errors don't persist after user edits
    setGlobalSaveError(null);
  }, [remoteDraft]);

  // ─── Per-section dirty tracking ────────────────────────────────────────
  const dirtySectionSet = useMemo(() => {
    const set = new Set<string>();
    for (const nav of REMOTE_SECTION_NAV) {
      if ((remoteDraft.dirtyKeys[nav.key]?.length ?? 0) > 0) {
        set.add(`remote-${nav.key}`);
      }
    }
    return set;
  }, [remoteDraft.dirtyKeys]);

  const isAnyRemoteDirty = remoteDraft.isDirty;

  const handleSaveAllRemote = useCallback(async (): Promise<boolean> => {
    const updates = remoteDraft.buildUpdates();
    if (Object.keys(updates).length === 0) return true;

    setIsSavingGlobal(true);
    setGlobalSaveError(null);

    try {
      await setPreferencesMutation.mutateAsync(updates);
      remoteDraft.markSaved();
      return true;
    } catch (err) {
      setGlobalSaveError(err);
      return false;
    } finally {
      setIsSavingGlobal(false);
    }
  }, [remoteDraft, setPreferencesMutation]);

  const handleDiscardAllRemote = useCallback(() => {
    remoteDraft.discard();
    setGlobalSaveError(null);
  }, [remoteDraft]);

  // ─── Preferences invalidation ──────────────────────────────────────────
  const emitSettingsSavedInvalidation = useCallback(
    (sid: string | null, sessionGen: number) => {
      invalidatePreferences(queryClient, {
        serverId: sid,
        sessionGeneration: sessionGen,
        isConnected,
      });
      void emitResourceInvalidated({
        session_generation: sessionGen,
        server_id: sid,
        resource: RESOURCE.PREFERENCES,
      });
      void emitResourceInvalidated({
        session_generation: sessionGen,
        server_id: sid,
        resource: RESOURCE.TORRENTS,
      });
    },
    [isConnected, queryClient],
  );

  useEffect(() => {
    if (setPreferencesMutation.isSuccess || toggleAltSpeedMutation.isSuccess) {
      emitSettingsSavedInvalidation(serverId, sessionGeneration);
    }
  }, [emitSettingsSavedInvalidation, serverId, sessionGeneration, toggleAltSpeedMutation.isSuccess, setPreferencesMutation.isSuccess]);

  const handleRemoteRetry = useCallback(() => {
    setPreferencesMutation.reset();
    void refetchRemotePreferences();
  }, [refetchRemotePreferences, setPreferencesMutation]);

  // ─── Close overlay state ──────────────────────────────────────────────────
  const [showCloseOverlay, setShowCloseOverlay] = useState(false);
  const [closeOverlayDirtyLabels, setCloseOverlayDirtyLabels] = useState<string[]>([]);

  // ─── Close confirmation refs ──────────────────────────────────────────
  // Prevent concurrent close-triggered saves
  const pendingCloseRef = useRef(false);
  const programmaticCloseRef = useRef(false);
  const dirtyKeysRef = useRef(remoteDraft.dirtyKeys);

  useEffect(() => { dirtyKeysRef.current = remoteDraft.dirtyKeys; }, [remoteDraft.dirtyKeys]);

  const handleOverlayStay = useCallback(() => {
    setShowCloseOverlay(false);
  }, []);

  const handleOverlayDiscard = useCallback(() => {
    pendingCloseRef.current = true;
    handleDiscardAllRemote();
    setShowCloseOverlay(false);
    programmaticCloseRef.current = true;
    void getCurrentWindow().close();
    setTimeout(() => { pendingCloseRef.current = false; }, 0);
  }, [handleDiscardAllRemote]);

  const handleOverlaySave = useCallback(() => {
    pendingCloseRef.current = true;
    setIsSavingGlobal(true);
    setShowCloseOverlay(false);
    setGlobalSaveError(null);
    void (async () => {
      const saved = await handleSaveAllRemote();
      setIsSavingGlobal(false);
      pendingCloseRef.current = false;
      if (saved) {
        programmaticCloseRef.current = true;
        await getCurrentWindow().close();
      }
    })();
  }, [handleSaveAllRemote]);

  // ─── Close request handling ─────────────────────────────────────────────
  // Refs for values needed inside the stable listener — always read the latest.
  const isAnyRemoteDirtyRef = useRef(isAnyRemoteDirty);
  useEffect(() => { isAnyRemoteDirtyRef.current = isAnyRemoteDirty; }, [isAnyRemoteDirty]);

  // Register listener exactly once — no dependencies so it never re-registers.
  useEffect(() => {
    const appWindow = getCurrentWindow();

    const handleCloseRequested = (event: { preventDefault: () => void }) => {
      // Programmatic close (e.g. Save All → close) bypasses the dirty flow.
      if (programmaticCloseRef.current) {
        programmaticCloseRef.current = false;
        return;
      }

      // Nothing dirty — allow the window to close.
      if (!isAnyRemoteDirtyRef.current) return;

      // A save-and-close triggered by this dialog is already pending.
      if (pendingCloseRef.current) {
        event.preventDefault();
        return;
      }

      // Gather dirty section labels for the confirmation dialog.
      const dirtyLabels: string[] = [];
      for (const nav of REMOTE_SECTION_NAV) {
        if ((dirtyKeysRef.current[nav.key]?.length ?? 0) > 0) {
          dirtyLabels.push(localization.t(nav.labelKey, { ns: 'settings' }));
        }
      }

      // Prevent close and show the overlay.
      event.preventDefault();
      setCloseOverlayDirtyLabels(dirtyLabels);
      setShowCloseOverlay(true);
    };

    const unlistenPromise = appWindow.onCloseRequested(handleCloseRequested);
    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // ─── Derived state ─────────────────────────────────────────────────────
  const hasActiveServer = Boolean(serverId);
  let remoteConnectionError = false;
  if (isHydrated) {
    remoteConnectionError = (!isConnected && !isConnecting) || Boolean(qbClientError);
  }
  const isRemotePreferencesLoading = isConnecting || isRemotePreferencesQueryLoading;
  // Sections stay mounted as long as a server is selected. Initial loads and
  // errors use stable skeleton cards instead of editable controls with empty data.
  const showRemoteSections = hasActiveServer;
  // Banner appears only for actionable states (no server, persistent errors).
  // Loading is NOT a banner state — per-section skeletons handle that so no extra
  // height is inserted/removed, keeping scroll position stable during server switch.
  const showStatusBanner = isHydrated && (
    !hasActiveServer || Boolean(remoteConnectionError) || Boolean(remotePreferencesError)
  );

  const navigationGroups = useMemo<SettingsNavGroup[]>(() => {
    const remoteItems = REMOTE_SECTION_NAV.map((r) => ({
      id: `remote-${r.key}` as SectionId,
      domain: 'qbittorrent' as const,
      labelKey: r.labelKey,
      label: t(r.labelKey),
      icon: r.icon,
      remoteSection: r.key,
    }));

    const appItems = APP_NAV_ITEMS.map((item) => ({
      ...item,
      label: t(item.labelKey),
    }));

    return [
      { id: 'app', label: t('screen.app'), items: appItems },
      { id: 'qbittorrent', label: 'qBittorrent', items: remoteItems },
    ];
  }, [t]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex flex-1 overflow-hidden">
        <SettingsSidebar
          navigationGroups={navigationGroups}
          activeSection={activeSection}
          onSelectSection={scrollToSection}
          dirtySections={dirtySectionSet}
        />

        <main ref={scrollRef} className="min-w-0 flex-1 overflow-auto scroll-smooth">
          <div className="mx-auto max-w-4xl px-4 py-4">
            {/* ── Page header ── */}
            <div className="mb-4">
              <h1 className="text-lg font-semibold text-text-primary">{t('title')}</h1>
              <p className="mt-1 text-sm text-text-secondary">
                {t('screen.description')}
              </p>
            </div>

            {/* ── Sections ── */}
            <div className="space-y-6">
              {/* ── App: App Behavior ── */}
              <section ref={setSectionRef('desktop-window')} id="desktop-window" className="scroll-mt-8">
                <SectionHeading icon={APP_NAV_ITEMS.find(i => i.id === 'desktop-window')!.icon} label={t('appBehavior')} />
                <WindowBehaviorSettings
                  closeToTray={localSettings.closeToTray}
                  startMinimized={localSettings.startMinimized}
                  autoStart={localSettings.autoStart}
                  downloadCompletionNotifications={localSettings.downloadCompletionNotifications}
                  isLoading={isLocalSettingsLoading}
                  error={localSettingsError}
                  onRetry={loadLocalSettings}
                  onChange={handleSettingChange}
                />
              </section>
              {/* ── App: Downloads ── */}
              <section ref={setSectionRef('desktop-downloads')} id="desktop-downloads" className="scroll-mt-8">
                <SectionHeading icon={APP_NAV_ITEMS.find(i => i.id === 'desktop-downloads')!.icon} label={t('downloads')} />
                <TaurentDownloadsSettings
                  deleteAddedTorrentFiles={localTorrentFilePreference.deleteAddedTorrentFiles}
                  isLoading={localTorrentFilePreference.isLoading}
                  error={localTorrentFilePreference.error
                    ? formatError(localTorrentFilePreference.error, 'app-settings')
                    : null}
                  onRetry={() => void localTorrentFilePreference.reload()}
                  onChange={(value) => void localTorrentFilePreference.setDeleteAddedTorrentFiles(value)}
                />
              </section>
              {/* ── App: Theme ── */}
              <section ref={setSectionRef('desktop-theme')} id="desktop-theme" className="scroll-mt-8">
                <SectionHeading icon={APP_NAV_ITEMS.find(i => i.id === 'desktop-theme')!.icon} label={t('appearance')} />
                <DesktopThemeSettings />
              </section>

              <section ref={setSectionRef('desktop-language')} id="desktop-language" className="scroll-mt-8">
                <SectionHeading icon={APP_NAV_ITEMS.find(i => i.id === 'desktop-language')!.icon} label={t('language')} />
                <LanguageSettingsPanel />
              </section>

              {/* ── App: About ── */}
              <section ref={setSectionRef('desktop-about')} id="desktop-about" className="scroll-mt-8">
                <SectionHeading icon={APP_NAV_ITEMS.find(i => i.id === 'desktop-about')!.icon} label={t('about')} />
                <DesktopAboutSettings />
              </section>

              {/* ── App: Servers ── */}
              <section ref={setSectionRef('desktop-servers')} id="desktop-servers" className="scroll-mt-8">
                <SectionHeading icon={APP_NAV_ITEMS.find(i => i.id === 'desktop-servers')!.icon} label={t('servers')} />
                <ServerOverviewSettings />
              </section>

              {/* ── App: Path Mappings ── */}
              <section ref={setSectionRef('desktop-path-mappings')} id="desktop-path-mappings" className="scroll-mt-8">
                <SectionHeading icon={APP_NAV_ITEMS.find(i => i.id === 'desktop-path-mappings')!.icon} label={t('pathMappings')} />
                <PathMappingsSettings />
              </section>

              {/* ── qBittorrent remote connection status ── */}
              {showStatusBanner && (
                <div className="rounded-md border border-border bg-surface p-3">
                  {!hasActiveServer ? (
                    <div className="text-center">
                      <p className="text-sm font-medium text-text-primary">{t('remoteStatus.noActiveServer')}</p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {t('screen.connectForRemote')}
                      </p>
                    </div>
                  ) : remoteConnectionError ? (
                    <div>
                      <p className="text-sm font-medium text-error">{t('remoteStatus.connectionFailed')}</p>
                      <p className="mt-1 text-xs text-text-secondary">{t('remoteStatus.couldNotReach')}</p>
                      <RetryButton onClick={handleRemoteRetry} className="mt-2" />
                    </div>
                  ) : remotePreferencesError ? (
                    <div>
                      <p className="text-sm font-medium text-error">{t('remoteStatus.loadFailed')}</p>
                      <p className="mt-1 text-xs text-text-secondary">{t('remoteStatus.couldNotFetch')}</p>
                      <RetryButton onClick={handleRemoteRetry} className="mt-2" />
                    </div>
                  ) : null}
                </div>
              )}

              {/* ── Remote sections ──
                  Kept in the DOM whenever a server exists so a server switch refreshes
                  values in-place without a layout collapse. Initial loads use stable
                  skeleton cards; background refreshes preserve the last values and
                  temporarily disable editing. ── */}
              {showRemoteSections && (
                <div className={
                  `space-y-6 ${
                    isRemotePreferencesLoading || !preferences
                      ? 'pointer-events-none opacity-50 transition-opacity duration-200'
                      : 'opacity-100 transition-opacity duration-200'
                  }`
                }>
                  {REMOTE_SECTION_NAV.map((nav) => {
                    return (
                      <section
                        key={nav.key}
                        ref={setSectionRef(`remote-${nav.key}`)}
                        id={`remote-${nav.key}`}
                        className="scroll-mt-8"
                      >
                        <SectionHeading icon={nav.icon} label={t(nav.labelKey)} />
                        {preferences ? (
                          <RemoteSettingsPanel
                            section={nav.key}
                            preferences={preferences as unknown as Record<string, unknown>}
                            stagedValues={remoteDraft.stagedValues[nav.key]}
                            baselineValues={remoteDraft.baselineValues[nav.key]}
                            onStagedChange={(key, value) => handleRemoteStagedChange(nav.key, key, value)}
                            dirtyKeys={remoteDraft.dirtyKeys[nav.key]}
                          />
                        ) : (
                          <RemoteSettingsSkeleton />
                        )}
                      </section>
                    );
                  })}
                </div>
              )}

            </div>
          </div>
        </main>
      </div>

      {/* ── Floating unsaved changes bar ── */}
      {isAnyRemoteDirty && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-md border border-border bg-surface-elevated px-4 py-2 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-primary" />
            <span className="text-sm font-medium text-text-primary">{t('screen.unsavedChanges')}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscardAllRemote}
              disabled={isSavingGlobal}
              className="h-8 rounded-sm border border-border px-3 text-sm font-medium text-text-secondary transition-colors enabled:hover:bg-surface-interactive enabled:hover:text-text-primary disabled:text-text-disabled disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled"
            >
              {t('screen.discardAll')}
            </button>
            <button
              type="button"
              onClick={() => void handleSaveAllRemote()}
              disabled={isSavingGlobal}
              className="h-8 rounded-sm border border-primary bg-primary px-4 text-sm font-medium text-text-on-primary transition-colors enabled:hover:bg-primary/90 disabled:text-text-disabled disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled"
            >
              {isSavingGlobal ? t('screen.saving') : t('screen.saveAll')}
            </button>
          </div>
          {/* Global save error — rendered inside the floating bar so it doesn't scatter across panels */}
          {globalSaveError !== null && (
            <span className="text-sm text-error">{formatError(globalSaveError, 'settings-save')}</span>
          )}
        </div>
      )}

      {/* ── Close overlay prompt ── */}
      {showCloseOverlay && (
        <SettingsCloseOverlay
          dirtyLabels={closeOverlayDirtyLabels}
          isSaving={isSavingGlobal}
          saveError={globalSaveError === null ? null : formatError(globalSaveError, 'settings-save')}
          onStay={handleOverlayStay}
          onDiscard={handleOverlayDiscard}
          onSave={handleOverlaySave}
        />
      )}
    </div>
  );
}

function SectionHeading({ icon: Icon, label }: { icon: import('react').ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Icon className="size-4 text-text-muted" />
      <h2 className="text-sm font-semibold text-text-primary">{label}</h2>
    </div>
  );
}

function RemoteSettingsSkeleton() {
  return (
    <div className="space-y-3 rounded-sm border border-border bg-surface p-4" aria-hidden="true">
      <SkeletonBlock height="2rem" background="bg-surface-interactive" />
      <SkeletonBlock height="2rem" background="bg-surface-interactive" />
      <SkeletonBlock height="2rem" background="bg-surface-interactive" />
    </div>
  );
}
