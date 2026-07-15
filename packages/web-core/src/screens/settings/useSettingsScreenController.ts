// Headless controller for SettingsScreen orchestration.
// Platform-agnostic — does not import @tauri-apps/* or produce UI.
//
// Extracts expanded-section state, modal/dialog state, server management handlers,
// theme summary derivation, and section summaries from the mobile SettingsScreen
// route into a reusable shared hook. UI rendering stays in the app route or
// shared web-ui body; this hook owns the headless state machine.
//
// Usage (mobile SettingsScreen):
//   const controller = useSettingsScreenController({
//     isConnected,
//     serverId,
//     serverName,
//     serverUrl,
//     servers,
//     config: useTheme().config,
//     updatePreference,
//     removeServer,
//     updateServer,
//     switchServer,
//     disconnect,
//     onNavigateToLogin: () => navigate('/servers'),
//     onNavigateToHome: () => navigate('/'),
//   });

import { useMemo, useState, useCallback } from 'react';
import { getThemeMetadata } from '@taurent/shared/theme/registry';
import type { ThemePalette, ThemeVariant, AccentPreference } from '@taurent/shared/theme/types';
import type { Server } from '@taurent/shared/types/server';
import { reportOperationFailure } from '../../hooks/operationFailureReporter';

// ─── Input types ─────────────────────────────────────────────────────────────

export interface SettingsScreenControllerConfig {
  mode: 'system' | 'manual';
  systemPalette: ThemePalette;
  manualPalette: ThemePalette;
  manualVariant: ThemeVariant;
  accent: AccentPreference;
}

export interface SettingsScreenControllerServerState {
  isConnected: boolean;
  serverId: string | null;
  serverName: string | null;
  serverUrl: string | null;
}

export interface SettingsScreenControllerOptions {
  // Connection state
  serverState: SettingsScreenControllerServerState;
  servers: Server[];

  // Mutation helpers
  updatePreference: (key: string, value: boolean | number | string) => void;

  // Server management
  removeServer: (serverId: string) => Promise<void>;
  updateServer: (
    serverId: string,
    updates: { name?: string; url?: string; username?: string },
  ) => Promise<void>;
  switchServer: (serverId: string) => Promise<void>;
  disconnect: () => Promise<void>;

  // Theme config
  config: SettingsScreenControllerConfig;

  // Navigation callbacks (no hardcoded route strings)
  onNavigateToLogin: () => void;
  onNavigateToHome: () => void;

  // Toggle alternative speed limits via the dedicated transfer API endpoint
  toggleSpeedLimitsMode: () => Promise<unknown>;
}

// ─── Output types ────────────────────────────────────────────────────────────

export type SectionKey =
  | 'server'
  | 'appearance'
  | 'speed'
  | 'downloads'
  | 'connection'
  | 'bittorrent'
  | 'webui'
  | 'advanced';

export type SectionSummaryKey = Exclude<SectionKey, 'server' | 'appearance'>;

export interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  onConfirm: () => Promise<void> | void;
}

export interface InputModalState {
  title: string;
  currentValue: number;
  onSubmit: (value: number) => void;
  unit?: string;
  unitMode?: 'bytes' | 'bytes-per-second';
  unitDefault?: 'b' | 'kb' | 'mb' | 'gb' | 'tb';
}

export interface SettingsScreenControllerResult {
  // ─── Section expand state ────────────────────────────────
  expandedSections: Record<SectionKey, boolean>;
  toggleSection: (section: SectionKey) => void;

  // ─── Input modal state ───────────────────────────────────
  inputModal: InputModalState | null;
  closeInputModal: () => void;

  // ─── Confirm dialog state ────────────────────────────────
  confirmDialog: ConfirmDialogState | null;
  closeConfirmDialog: () => void;

  // ─── Server editing state ────────────────────────────────
  editingServerId: string | null;
  editName: string;
  editUrl: string;
  editUsername: string;
  setEditName: (name: string) => void;
  setEditUrl: (url: string) => void;
  setEditUsername: (username: string) => void;

  // ─── Server switch state ────────────────────────────────
  switchingServerId: string | null;

  // ─── Server action handlers ─────────────────────────────
  handleEditServer: (serverId: string) => void;
  handleSaveEdit: () => Promise<void>;
  handleCancelEdit: () => void;
  handleSwitchServer: (serverId: string) => Promise<void>;
  handleRemoveServer: (id: string, name: string) => void;

  // ─── Transfer limit handlers ────────────────────────────
  handleSpeedModeToggle: () => void;
  handleEditTransferLimit: (prefKey: string, currentValue: number) => void;

  // ─── Derived summaries ─────────────────────────────────
  themeSummary: string;
  sectionSummaries: Record<SectionSummaryKey, string>;
}

// ─── Implementation ─────────────────────────────────────────────────────────

function formatPaletteSummary(palette: ThemePalette, variant: 'light' | 'dark') {
  const paletteMeta = getThemeMetadata(palette);
  if (!paletteMeta) return 'Theme';
  if (paletteMeta.darkOnly) return paletteMeta.label;
  return `${paletteMeta.label} · ${variant === 'light' ? 'Light' : 'Dark'}`;
}

export function useSettingsScreenController({
  serverState,
  servers,
  updatePreference,
  removeServer,
  updateServer,
  switchServer,
  disconnect,
  config,
  onNavigateToLogin,
  onNavigateToHome,
  toggleSpeedLimitsMode,
}: SettingsScreenControllerOptions): SettingsScreenControllerResult {
  // ─── Section expand state ────────────────────────────────
  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
    server: false,
    appearance: true,
    speed: false,
    downloads: false,
    connection: false,
    webui: false,
    bittorrent: false,
    advanced: false,
  });

  const toggleSection = useCallback((section: SectionKey) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // ─── Input modal state ───────────────────────────────────
  const [inputModal, setInputModal] = useState<InputModalState | null>(null);
  const closeInputModal = useCallback(() => setInputModal(null), []);

  // ─── Confirm dialog state ────────────────────────────────
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const closeConfirmDialog = useCallback(() => setConfirmDialog(null), []);

  // ─── Server editing state ────────────────────────────────
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editUsername, setEditUsername] = useState('');

  // ─── Server switch state ────────────────────────────────
  const [switchingServerId, setSwitchingServerId] = useState<string | null>(null);

  const handleEditServer = useCallback(
    (serverId: string) => {
      const server = servers.find((s) => s.id === serverId);
      if (server) {
        setEditingServerId(serverId);
        setEditName(server.name);
        setEditUrl(server.url);
        setEditUsername(server.username || '');
      }
    },
    [servers]
  );

  const handleSaveEdit = useCallback(async () => {
    if (!editingServerId || !editName.trim() || !editUrl.trim() || !editUsername.trim()) {
      return;
    }
    try {
      await updateServer(editingServerId, {
        name: editName.trim(),
        url: editUrl.trim(),
        username: editUsername.trim(),
      });
      setEditingServerId(null);
    } catch {
      // Update failed — keep editing state so user can retry
    }
  }, [editingServerId, editName, editUrl, editUsername, updateServer]);

  const handleCancelEdit = useCallback(() => {
    setEditingServerId(null);
  }, []);

  // ─── Server action handlers ──────────────────────────────

  const handleRemoveServer = useCallback(
    (id: string, name: string) => {
      setConfirmDialog({
        title: `Remove ${name}?`,
        message: 'This deletes the saved server entry and its stored session data on this device.',
        confirmLabel: 'Remove server',
        tone: 'danger',
        onConfirm: async () => {
          await removeServer(id);
          if (serverState.isConnected && serverState.serverId === id) {
            await disconnect();
            onNavigateToLogin();
          }
        },
      });
    },
    [removeServer, serverState.isConnected, serverState.serverId, disconnect, onNavigateToLogin]
  );

  const handleSwitchServer = useCallback(
    async (serverId: string) => {
      setSwitchingServerId(serverId);
      try {
        // The controller's switchServer calls the atomic sessionSwitchServerById bridge method,
        // which commits the new session only on success. On failure the previous session
        // remains intact (no disconnect, no candidate select).
        await switchServer(serverId);
        onNavigateToHome();
      } catch (error) {
        // Surface the failure through the operation-notification path so the user sees
        // a visible error. The switching spinner state is cleared so the UI is unblocked.
        reportOperationFailure({
          operation: 'server-switch:settings',
          error,
        });
        setSwitchingServerId(null);
      }
    },
    [switchServer, onNavigateToHome]
  );

  // ─── Transfer limit handlers ──────────────────────────────

  const handleSpeedModeToggle = useCallback(() => {
    toggleSpeedLimitsMode();
  }, [toggleSpeedLimitsMode]);

  const handleEditTransferLimit = useCallback(
    (prefKey: string, currentValue: number) => {
      const isDownload = prefKey === 'dl_limit' || prefKey === 'alt_dl_limit';
      const isUpload = prefKey === 'up_limit' || prefKey === 'alt_up_limit';

      let title = 'Speed Limit';
      if (isDownload) title = 'Download Limit';
      if (isUpload) title = 'Upload Limit';

      setInputModal({
        title,
        currentValue,
        unit: 'Use 0 for unlimited speed.',
        unitMode: 'bytes-per-second',
        unitDefault: 'kb',
        onSubmit: (value) => {
          updatePreference(prefKey, value);
        },
      });
    },
    [updatePreference]
  );

  // ─── Theme summary ────────────────────────────────────────
  const themeSummary = useMemo(() => {
    const effectivePalette = config.mode === 'system' ? config.systemPalette : config.manualPalette;

    let summary: string;
    if (config.mode === 'system') {
      summary = `System · ${getThemeMetadata(config.systemPalette)?.label ?? 'Theme'}`;
    } else {
      summary = `Manual · ${formatPaletteSummary(config.manualPalette, config.manualVariant)}`;
    }

    if (effectivePalette === 'midnight' && config.accent) {
      summary += ` · Custom accent`;
    }

    return summary;
  }, [config.mode, config.systemPalette, config.manualPalette, config.manualVariant, config.accent]);

  // ─── Section summaries ────────────────────────────────────
  const sectionSummaries: Record<SectionSummaryKey, string> = {
    speed: 'Download and upload speed limits',
    connection: 'Listening port and network preferences',
    downloads: 'Save path, paused starts, and folder rules',
    bittorrent: 'Queueing, seeding ratios, and protocol options',
    webui: 'Remote interface port and access control',
    advanced: 'Connection limits and network tuning',
  };

  return {
    expandedSections,
    toggleSection,
    inputModal,
    closeInputModal,
    confirmDialog,
    closeConfirmDialog,
    editingServerId,
    editName,
    editUrl,
    editUsername,
    setEditName,
    setEditUrl,
    setEditUsername,
    switchingServerId,
    handleEditServer,
    handleSaveEdit,
    handleCancelEdit,
    handleSwitchServer,
    handleRemoveServer,
    handleSpeedModeToggle,
    handleEditTransferLimit,
    themeSummary,
    sectionSummaries,
  };
}
