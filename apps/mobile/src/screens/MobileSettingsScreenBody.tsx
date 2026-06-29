import React, { useMemo, useState } from 'react';
import { cn } from '@taurent/shared';
import type { Preferences } from '@taurent/shared';
import {
  type RemoteSettingsField,
  type RemoteSettingsSectionKey,
  REMOTE_SETTINGS_SECTIONS,
  toUiNumberValue,
  toWireNumberValue,
} from '@taurent/shared/settings';
import { getThemeOptions, isDarkOnlyTheme } from '@taurent/shared/theme/registry';
import type { AccentPreference, ThemePalette, ThemeVariant } from '@taurent/shared/theme/types';
import type { Server } from '@taurent/shared/types/server';
import {
  Button,
  ConfirmDialog,
  Input,
  NumberInputModal,
  RetryButton,
  ScreenHeader,
  Select,
  StateCard,
  ToggleSwitch,
} from '@taurent/web-ui';
import { useNavigate } from 'react-router-dom';

import { appBuildMetadata } from '../buildMetadata';
import { Icon } from '../ui/Icon';

export type MobileRemoteSnapshots = Partial<Record<RemoteSettingsSectionKey, Record<string, unknown>>>;

type MobileSettingsSectionKey =
  | 'appearance'
  | 'speed'
  | 'downloads'
  | 'connection'
  | 'bittorrent'
  | 'webui'
  | 'advanced'
  | 'about';

type MobileRemoteSectionKey = Extract<MobileSettingsSectionKey, RemoteSettingsSectionKey>;

interface NumberEditorState {
  section: RemoteSettingsSectionKey;
  key: string;
  title: string;
  currentValue: number;
  unit?: string;
  unitMode?: 'bytes' | 'bytes-per-second';
  unitDefault?: 'b' | 'kb' | 'mb' | 'gb';
  fromDisplay?: (value: number) => number;
  field: RemoteSettingsField;
}

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  onConfirm: () => Promise<void> | void;
}

interface MobileSettingsScreenBodyProps {
  connection: {
    isConnected: boolean;
    serverName: string | null;
    serverUrl: string | null;
  };
  servers: Server[];
  serverId: string | null;
  preferences: Preferences | null;
  effectivePreferences: Record<string, unknown> | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  themeSummary: string;
  sectionSummaries: Record<string, string>;
  themeConfig: {
    mode: 'system' | 'manual';
    systemPalette: ThemePalette;
    manualPalette: ThemePalette;
    manualVariant: ThemeVariant;
    accent: AccentPreference;
  };
  onThemeModeChange: (mode: 'system' | 'manual') => void;
  onSystemPaletteChange: (palette: ThemePalette) => void;
  onManualPaletteChange: (palette: ThemePalette) => void;
  onManualVariantChange: (variant: ThemeVariant) => void;
  onAccentChange: (accent: AccentPreference) => void;
  stagedValues: MobileRemoteSnapshots;
  baselineValues: MobileRemoteSnapshots;
  dirtyKeys: Partial<Record<RemoteSettingsSectionKey, string[]>>;
  isRemoteDirty: boolean;
  isSavingRemote: boolean;
  remoteSaveError: string | null;
  onRemoteFieldChange: (section: RemoteSettingsSectionKey, key: string, value: boolean | number | string) => void;
  onSaveRemote: () => void;
  onDiscardRemote: () => void;
  onOpenServerSwitcher: () => void;
  onOpenStatistics: () => void;
  confirmDialog: ConfirmDialogState | null;
  onCloseConfirmDialog: () => void;
}

const REMOTE_SECTIONS: Array<{
  key: MobileRemoteSectionKey;
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
  summaryKey: string;
}> = [
  { key: 'downloads', label: 'Downloads', icon: 'download', summaryKey: 'downloads' },
  { key: 'connection', label: 'Connection', icon: 'link', summaryKey: 'connection' },
  { key: 'speed', label: 'Speed', icon: 'arrow-up-down', summaryKey: 'speed' },
  { key: 'bittorrent', label: 'BitTorrent', icon: 'list', summaryKey: 'bittorrent' },
  { key: 'webui', label: 'WebUI', icon: 'globe', summaryKey: 'webui' },
  { key: 'advanced', label: 'Advanced', icon: 'settings', summaryKey: 'advanced' },
];

export function MobileSettingsScreenBody({
  connection,
  servers,
  preferences,
  effectivePreferences,
  isLoading,
  error,
  onRetry,
  themeSummary,
  sectionSummaries,
  themeConfig,
  onThemeModeChange,
  onSystemPaletteChange,
  onManualPaletteChange,
  onManualVariantChange,
  onAccentChange,
  stagedValues,
  baselineValues,
  dirtyKeys,
  isRemoteDirty,
  isSavingRemote,
  remoteSaveError,
  onRemoteFieldChange,
  onSaveRemote,
  onDiscardRemote,
  onOpenServerSwitcher,
  onOpenStatistics,
  confirmDialog,
  onCloseConfirmDialog,
}: MobileSettingsScreenBodyProps) {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<MobileSettingsSectionKey | null>(null);
  const [numberEditor, setNumberEditor] = useState<NumberEditorState | null>(null);

  const activeTitle = activeSection ? getSectionTitle(activeSection) : 'Settings';

  const closeSection = () => {
    setActiveSection(null);
    setNumberEditor(null);
  };

  const handleBack = activeSection ? closeSection : () => navigate('/');
  const bottomPaddingClass = isRemoteDirty ? 'pb-[calc(11rem+var(--sab))]' : 'pb-[calc(5rem+var(--sab))]';

  return (
    <div className="flex min-h-full flex-col bg-background">
      <ScreenHeader
        title={activeTitle}
        variant="mobile"
        mobileWidth="compact"
        onBack={handleBack}
      />

      <main className={cn('mx-auto w-full max-w-lg px-2 pt-3', bottomPaddingClass)}>
        {activeSection ? (
          <SectionEditor
            section={activeSection}
            connection={connection}
            servers={servers}
            preferences={preferences}
            effectivePreferences={effectivePreferences}
            isLoading={isLoading}
            error={error}
            onRetry={onRetry}
            themeConfig={themeConfig}
            onThemeModeChange={onThemeModeChange}
            onSystemPaletteChange={onSystemPaletteChange}
            onManualPaletteChange={onManualPaletteChange}
            onManualVariantChange={onManualVariantChange}
            onAccentChange={onAccentChange}
            stagedValues={stagedValues}
            baselineValues={baselineValues}
            dirtyKeys={dirtyKeys}
            onRemoteFieldChange={onRemoteFieldChange}
            onOpenNumberEditor={setNumberEditor}
            onOpenServerSwitcher={onOpenServerSwitcher}
            onOpenStatistics={onOpenStatistics}
          />
        ) : (
          <SettingsOverview
            connection={connection}
            servers={servers}
            themeSummary={themeSummary}
            sectionSummaries={sectionSummaries}
            dirtyKeys={dirtyKeys}
            isConnected={connection.isConnected}
            onOpenSection={setActiveSection}
            onOpenServerSwitcher={onOpenServerSwitcher}
            onOpenStatistics={onOpenStatistics}
          />
        )}
      </main>

      {isRemoteDirty ? (
        <MobileSaveBar
          isSaving={isSavingRemote}
          error={remoteSaveError}
          onDiscard={onDiscardRemote}
          onSave={onSaveRemote}
        />
      ) : null}

      {numberEditor ? (
        <NumberInputModal
          title={numberEditor.title}
          currentValue={numberEditor.currentValue}
          unit={numberEditor.unit}
          unitMode={numberEditor.unitMode}
          unitDefault={numberEditor.unitDefault}
          onSubmit={(value) => {
            const finalValue = !numberEditor.unitMode && numberEditor.fromDisplay
              ? numberEditor.fromDisplay(value)
              : value;
            onRemoteFieldChange(numberEditor.section, numberEditor.key, toWireNumberValue(numberEditor.field, finalValue));
            setNumberEditor(null);
          }}
          onCancel={() => setNumberEditor(null)}
        />
      ) : null}

      {confirmDialog ? (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          onConfirm={confirmDialog.onConfirm}
          onCancel={onCloseConfirmDialog}
          tone={confirmDialog.tone}
        />
      ) : null}
    </div>
  );
}

function SettingsOverview({
  connection,
  servers,
  themeSummary,
  sectionSummaries,
  dirtyKeys,
  isConnected,
  onOpenSection,
  onOpenServerSwitcher,
  onOpenStatistics,
}: {
  connection: MobileSettingsScreenBodyProps['connection'];
  servers: Server[];
  themeSummary: string;
  sectionSummaries: Record<string, string>;
  dirtyKeys: Partial<Record<RemoteSettingsSectionKey, string[]>>;
  isConnected: boolean;
  onOpenSection: (section: MobileSettingsSectionKey) => void;
  onOpenServerSwitcher: () => void;
  onOpenStatistics: () => void;
}) {
  return (
    <div className="space-y-5">
      <ServerSummary
        connection={connection}
        servers={servers}
        onOpenServerSwitcher={onOpenServerSwitcher}
        onOpenStatistics={onOpenStatistics}
      />

      <SettingsList label="App">
        <SettingsListButton
          icon="brush"
          title="Appearance"
          summary={themeSummary}
          onClick={() => onOpenSection('appearance')}
        />
        <SettingsListButton
          icon="settings"
          title="About"
          summary="Version and app information"
          onClick={() => onOpenSection('about')}
        />
      </SettingsList>

      <SettingsList label="qBittorrent">
        {REMOTE_SECTIONS.map((section) => (
          <SettingsListButton
            key={section.key}
            icon={section.icon}
            title={section.label}
            summary={isConnected ? sectionSummaries[section.summaryKey] : 'Connect to edit'}
            dirty={(dirtyKeys[section.key]?.length ?? 0) > 0}
            disabled={!isConnected}
            onClick={() => onOpenSection(section.key)}
          />
        ))}
      </SettingsList>
    </div>
  );
}

function ServerSummary({
  connection,
  servers,
  onOpenServerSwitcher,
  onOpenStatistics,
}: {
  connection: MobileSettingsScreenBodyProps['connection'];
  servers: Server[];
  onOpenServerSwitcher: () => void;
  onOpenStatistics: () => void;
}) {
  return (
    <section>
      <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Server</h2>
      <div className="divide-y divide-border border-y border-border bg-surface">
        <div className="flex min-h-16 items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
            <Icon name="server" iconSize="lg" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-base font-medium text-text-primary">
                {connection.isConnected ? connection.serverName || 'Current server' : 'No active connection'}
              </span>
              <span
                className={cn(
                  'shrink-0 rounded-sm px-2 py-1 text-xs font-medium',
                  connection.isConnected ? 'bg-success/10 text-success' : 'bg-surface-interactive text-text-secondary',
                )}
              >
                {connection.isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <p className="mt-1 truncate text-sm text-text-secondary">
              {connection.isConnected ? connection.serverUrl : `${servers.length} saved ${servers.length === 1 ? 'server' : 'servers'}`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenServerSwitcher}
          className="flex min-h-12 w-full items-center justify-between px-4 py-3 text-left transition-colors enabled:active:bg-surface-interactive disabled:text-text-disabled disabled:cursor-not-allowed"
        >
          <span className="text-sm font-medium text-text-primary disabled:text-text-disabled">Manage Servers</span>
          <Icon name="chevron-down" iconSize="md" className="shrink-0 -rotate-90 text-text-muted disabled:text-text-disabled" />
        </button>

        {connection.isConnected ? (
          <button
            type="button"
            onClick={onOpenStatistics}
            className="flex min-h-12 w-full items-center justify-between px-4 py-3 text-left transition-colors enabled:active:bg-surface-interactive disabled:text-text-disabled disabled:cursor-not-allowed"
          >
            <span className="text-sm font-medium text-text-primary disabled:text-text-disabled">View Statistics</span>
            <Icon name="chevron-down" iconSize="md" className="shrink-0 -rotate-90 text-text-muted disabled:text-text-disabled" />
          </button>
        ) : null}
      </div>
    </section>
  );
}

function SettingsList({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</h2>
      <div className="divide-y divide-border border-y border-border bg-surface">
        {children}
      </div>
    </section>
  );
}

function SettingsListButton({
  icon,
  title,
  summary,
  dirty,
  disabled,
  onClick,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  title: string;
  summary?: string;
  dirty?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors enabled:active:bg-surface-interactive disabled:text-text-disabled disabled:cursor-not-allowed"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center text-primary disabled:text-text-disabled">
        <Icon name={icon} iconSize="lg" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-base font-medium text-text-primary disabled:text-text-disabled">{title}</span>
          {dirty ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
        </div>
        {summary ? <p className="mt-1 truncate text-sm text-text-secondary disabled:text-text-disabled">{summary}</p> : null}
      </div>
      <Icon name="chevron-down" iconSize="md" className="shrink-0 -rotate-90 text-text-muted disabled:text-text-disabled" />
    </button>
  );
}

function SectionEditor(props: {
  section: MobileSettingsSectionKey;
  connection: MobileSettingsScreenBodyProps['connection'];
  servers: Server[];
  preferences: Preferences | null;
  effectivePreferences: Record<string, unknown> | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  themeConfig: MobileSettingsScreenBodyProps['themeConfig'];
  onThemeModeChange: (mode: 'system' | 'manual') => void;
  onSystemPaletteChange: (palette: ThemePalette) => void;
  onManualPaletteChange: (palette: ThemePalette) => void;
  onManualVariantChange: (variant: ThemeVariant) => void;
  onAccentChange: (accent: AccentPreference) => void;
  stagedValues: MobileRemoteSnapshots;
  baselineValues: MobileRemoteSnapshots;
  dirtyKeys: Partial<Record<RemoteSettingsSectionKey, string[]>>;
  onRemoteFieldChange: (section: RemoteSettingsSectionKey, key: string, value: boolean | number | string) => void;
  onOpenNumberEditor: (state: NumberEditorState) => void;
  onOpenServerSwitcher: () => void;
  onOpenStatistics: () => void;
}) {
  const { section } = props;

  if (section === 'appearance') {
    return (
      <AppearanceEditor
        themeConfig={props.themeConfig}
        onThemeModeChange={props.onThemeModeChange}
        onSystemPaletteChange={props.onSystemPaletteChange}
        onManualPaletteChange={props.onManualPaletteChange}
        onManualVariantChange={props.onManualVariantChange}
        onAccentChange={props.onAccentChange}
      />
    );
  }

  if (section === 'about') {
    return <AboutEditor />;
  }

  if (!props.connection.isConnected) {
    return (
      <StateCard
        title="Not connected"
        message="Connect to a server before editing qBittorrent settings."
        action={<Button onClick={props.onOpenServerSwitcher}>Open Servers</Button>}
      />
    );
  }

  if (props.isLoading) {
    return <StateCard title="Loading preferences" message="Pulling settings from qBittorrent." />;
  }

  if (props.error || !props.preferences || !props.effectivePreferences) {
    return (
      <StateCard
        title="Could not load preferences"
        message={props.error ?? 'The server settings payload is unavailable.'}
        action={<RetryButton onClick={props.onRetry} />}
      />
    );
  }

  const handleRevert = (fieldKey: string) => {
    const baseline = props.baselineValues[section]?.[fieldKey];
    if (baseline !== undefined) {
      props.onRemoteFieldChange(section, fieldKey, baseline as boolean | number | string);
    }
  };

  return (
    <RemoteSectionEditor
      section={section}
      effectivePreferences={props.effectivePreferences}
      dirtyKeys={props.dirtyKeys[section] ?? []}
      onFieldChange={(key, value) => props.onRemoteFieldChange(section, key, value)}
      onOpenNumberEditor={props.onOpenNumberEditor}
      onRevert={handleRevert}
    />
  );
}

function AppearanceEditor({
  themeConfig,
  onThemeModeChange,
  onSystemPaletteChange,
  onManualPaletteChange,
  onManualVariantChange,
  onAccentChange,
}: {
  themeConfig: MobileSettingsScreenBodyProps['themeConfig'];
  onThemeModeChange: (mode: 'system' | 'manual') => void;
  onSystemPaletteChange: (palette: ThemePalette) => void;
  onManualPaletteChange: (palette: ThemePalette) => void;
  onManualVariantChange: (variant: ThemeVariant) => void;
  onAccentChange: (accent: AccentPreference) => void;
}) {
  const themeOptions = useMemo(() => getThemeOptions(), []);
  const activePalette = themeConfig.mode === 'system' ? themeConfig.systemPalette : themeConfig.manualPalette;
  const isManualMode = themeConfig.mode === 'manual';

  const handlePaletteChange = (palette: ThemePalette) => {
    if (themeConfig.mode === 'system') {
      onSystemPaletteChange(palette);
      return;
    }

    onManualPaletteChange(palette);
    if (isDarkOnlyTheme(palette)) {
      onManualVariantChange('dark');
    }
  };

  return (
    <div className="space-y-5">
      <SettingsList label="Mode">
        <SegmentedRow
          options={[
            { value: 'system', label: 'System' },
            { value: 'manual', label: 'Manual' },
          ]}
          value={themeConfig.mode}
          onChange={(value) => onThemeModeChange(value as 'system' | 'manual')}
        />
      </SettingsList>

      <SettingsList label="Palette">
        {themeOptions.map((option) => {
          const selected = option.palette === activePalette;
          const supportsVariant = isManualMode && !option.darkOnly;

          return (
            <div
              key={option.palette}
              className="flex min-h-16 w-full items-center gap-3 px-4 py-3"
            >
              <button
                type="button"
                onClick={() => handlePaletteChange(option.palette)}
                className="flex min-w-0 flex-1 items-center gap-3 self-stretch text-left"
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                    selected ? 'border-primary bg-primary/10 text-primary' : 'border-border text-transparent',
                  )}
                >
                  <span className="h-3 w-3 rounded-full bg-current" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-text-primary">{option.label}</span>
                  <span className="mt-1 block text-sm text-text-secondary">{option.description}</span>
                </span>
              </button>
              {supportsVariant ? (
                <PaletteVariantToggle
                  active={selected}
                  value={themeConfig.manualVariant}
                  onChange={(variant) => {
                    onManualPaletteChange(option.palette);
                    onManualVariantChange(variant);
                  }}
                />
              ) : option.darkOnly ? (
                <span className="shrink-0 rounded-sm bg-surface-interactive px-2 py-1 text-xs font-medium text-text-secondary">
                  Dark only
                </span>
              ) : null}
            </div>
          );
        })}
      </SettingsList>

      {activePalette === 'midnight' ? (
        <SettingsList label="Accent">
          <div className="space-y-2 px-4 py-3">
            <Input
              label="Midnight accent"
              value={themeConfig.accent ?? ''}
              placeholder="#3b82f6"
              onChange={(value) => onAccentChange(value.trim() ? (value as AccentPreference) : null)}
            />
            <Button variant="outline" size="sm" onClick={() => onAccentChange(null)}>
              Reset Accent
            </Button>
          </div>
        </SettingsList>
      ) : null}
    </div>
  );
}

function PaletteVariantToggle({
  active,
  value,
  onChange,
}: {
  active: boolean;
  value: ThemeVariant;
  onChange: (value: ThemeVariant) => void;
}) {
  const options: Array<{ value: ThemeVariant; label: string }> = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  return (
    <div
      role="group"
      aria-label="Theme variant"
      className="grid shrink-0 grid-cols-2 rounded-sm border border-border bg-background p-1"
    >
      {options.map((option) => {
        const selected = active && value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-8 min-w-12 rounded-sm px-2 text-xs font-medium transition-colors',
              selected
                ? 'bg-primary text-text-on-primary disabled:bg-bg-disabled disabled:text-text-disabled disabled:cursor-not-allowed'
                : 'text-text-secondary enabled:active:bg-surface-interactive disabled:text-text-disabled disabled:cursor-not-allowed',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function SegmentedRow({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 px-4 py-3">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'min-h-11 rounded-sm border px-3 text-sm font-medium transition-colors',
            option.value === value
              ? 'border-primary bg-primary text-text-on-primary disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled disabled:cursor-not-allowed'
              : 'border-border bg-background text-text-secondary enabled:active:bg-surface-interactive disabled:text-text-disabled disabled:cursor-not-allowed',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function RemoteSectionEditor({
  section,
  effectivePreferences,
  dirtyKeys,
  onFieldChange,
  onOpenNumberEditor,
  onRevert,
}: {
  section: RemoteSettingsSectionKey;
  effectivePreferences: Record<string, unknown>;
  dirtyKeys: string[];
  onFieldChange: (key: string, value: boolean | number | string) => void;
  onOpenNumberEditor: (state: NumberEditorState) => void;
  onRevert?: (key: string) => void;
}) {
  const sectionDef = REMOTE_SETTINGS_SECTIONS[section];
  const groups = sectionDef.groups;
  const desktopFields = sectionDef.desktopFields;

  const visibleFields = useMemo(
    () =>
      desktopFields.filter(
        (field) => !field.visibleWhen || field.visibleWhen(effectivePreferences),
      ),
    [desktopFields, effectivePreferences],
  );

  const groupedFields = useMemo(() => {
    const map = new Map<string | undefined, RemoteSettingsField[]>();
    for (const field of visibleFields) {
      const key = field.group;
      const fields = map.get(key) ?? [];
      fields.push(field);
      map.set(key, fields);
    }
    return map;
  }, [visibleFields]);

  const ungroupedFields = groupedFields.get(undefined) ?? [];

  return (
    <div className="space-y-5">
      {ungroupedFields.length > 0 && (
        <SettingsList label={sectionDef.title}>
          {ungroupedFields.map((field) => (
            <RemoteFieldRow
              key={field.key}
              section={section}
              field={field}
              value={effectivePreferences[field.key]}
              isDirty={dirtyKeys.includes(field.key)}
              onFieldChange={onFieldChange}
              onOpenNumberEditor={onOpenNumberEditor}
              onRevert={onRevert}
            />
          ))}
        </SettingsList>
      )}
      {groups?.map((group) => {
        const groupFields = groupedFields.get(group.key) ?? [];
        if (groupFields.length === 0) return null;
        return (
          <SettingsList key={group.key} label={group.title}>
            {groupFields.map((field) => (
              <RemoteFieldRow
                key={field.key}
                section={section}
                field={field}
                value={effectivePreferences[field.key]}
                isDirty={dirtyKeys.includes(field.key)}
                onFieldChange={onFieldChange}
                onOpenNumberEditor={onOpenNumberEditor}
                onRevert={onRevert}
              />
            ))}
          </SettingsList>
        );
      })}
    </div>
  );
}

function getFieldTitle(field: RemoteSettingsField): string {
  if (field.label) {
    return field.label;
  }

  if (field.kind === 'number' || field.kind === 'unlimitedNumber') {
    return field.mobileEditor?.title ?? field.key;
  }

  return field.key;
}

function RemoteFieldRow({
  section,
  field,
  value,
  isDirty,
  onFieldChange,
  onOpenNumberEditor,
  onRevert,
}: {
  section: RemoteSettingsSectionKey;
  field: RemoteSettingsField;
  value: unknown;
  isDirty: boolean;
  onFieldChange: (key: string, value: boolean | number | string) => void;
  onOpenNumberEditor: (state: NumberEditorState) => void;
  onRevert?: (key: string) => void;
}) {
  const title = getFieldTitle(field);

  if (field.kind === 'boolean') {
    return (
      <SettingControlRow
        title={title}
        description={field.description}
        dirty={isDirty}
        control={
          <div className="flex items-center gap-2">
            {isDirty && onRevert ? (
              <button
                type="button"
                onClick={() => onRevert(field.key)}
                className="text-xs font-medium text-text-muted enabled:hover:text-text-primary disabled:text-text-disabled disabled:cursor-not-allowed"
              >
                Revert
              </button>
            ) : null}
            <ToggleSwitch
              checked={Boolean(value)}
              onChange={(checked) => onFieldChange(field.key, checked)}
            />
          </div>
        }
      />
    );
  }

  if (field.kind === 'number') {
    const editor = field.mobileEditor;
    if (!editor) return null;

    const rawValue = toUiNumberValue(field, value);
    const currentValue = editor.unitMode
      ? rawValue
      : editor.toDisplay
        ? editor.toDisplay(rawValue)
        : rawValue;
    const displayValue = editor.display ? editor.display(rawValue) : String(currentValue);

    return (
      <div className="flex min-h-16 w-full items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => onOpenNumberEditor({
            section,
            key: field.key,
            title: editor.title,
            currentValue,
            unit: editor.unit,
            unitMode: editor.unitMode,
            unitDefault: editor.unitDefault,
            fromDisplay: editor.fromDisplay,
            field,
          })}
          className="flex flex-1 items-center gap-3 text-left transition-colors enabled:active:bg-surface-interactive disabled:text-text-disabled disabled:cursor-not-allowed"
        >
          <SettingText title={title} description={field.description} dirty={isDirty} />
          <span className="max-w-[40%] shrink-0 truncate text-sm font-medium text-text-secondary">
            {displayValue}
          </span>
        </button>
        {isDirty && onRevert ? (
          <button
            type="button"
            onClick={() => onRevert(field.key)}
            className="shrink-0 text-xs font-medium text-text-muted enabled:hover:text-text-primary disabled:text-text-disabled disabled:cursor-not-allowed"
          >
            Revert
          </button>
        ) : null}
        <Icon name="chevron-down" iconSize="md" className="shrink-0 -rotate-90 text-text-muted" />
      </div>
    );
  }

  if (field.kind === 'unlimitedNumber') {
    const editor = field.mobileEditor;
    if (!editor) return null;

    const rawValue = toUiNumberValue(field, value);
    const isEnabled = rawValue !== field.disabledValue;
    const currentValue = isEnabled ? rawValue : field.defaultEnabledValue;
    const displayValue = isEnabled
      ? (editor.display ? editor.display(rawValue) : field.enabledLabel ? `${currentValue} ${field.enabledLabel}` : String(currentValue))
      : field.disabledLabel;

    return (
      <div className="flex min-h-16 items-center gap-3 px-4 py-3">
        <ToggleSwitch
          checked={isEnabled}
          onChange={(checked) => {
            onFieldChange(field.key, checked ? field.defaultEnabledValue : field.disabledValue);
          }}
        />
        <button
          type="button"
          disabled={!isEnabled}
          onClick={() => onOpenNumberEditor({
            section,
            key: field.key,
            title: editor.title,
            currentValue: editor.unitMode
              ? currentValue
              : editor.toDisplay
                ? editor.toDisplay(currentValue)
                : currentValue,
            unit: editor.unit,
            unitMode: editor.unitMode,
            unitDefault: editor.unitDefault,
            fromDisplay: editor.fromDisplay,
            field,
          })}
          className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:text-text-disabled disabled:cursor-not-allowed"
        >
          <SettingText title={title} description={field.description} dirty={isDirty} />
          <span className="max-w-[40%] shrink-0 truncate text-sm font-medium text-text-secondary">
            {displayValue}
          </span>
        </button>
        {isDirty && onRevert ? (
          <button
            type="button"
            onClick={() => onRevert(field.key)}
            className="shrink-0 text-xs font-medium text-text-muted enabled:hover:text-text-primary disabled:text-text-disabled disabled:cursor-not-allowed"
          >
            Revert
          </button>
        ) : null}
        <Icon name="chevron-down" iconSize="md" className="shrink-0 -rotate-90 text-text-muted" />
      </div>
    );
  }

  if (field.kind === 'select') {
    return (
      <div className="space-y-2 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <SettingText title={title} description={field.description} dirty={isDirty} />
          {isDirty && onRevert ? (
            <button
              type="button"
              onClick={() => onRevert(field.key)}
              className="shrink-0 pt-1 text-xs font-medium text-text-muted enabled:hover:text-text-primary disabled:text-text-disabled disabled:cursor-not-allowed"
            >
              Revert
            </button>
          ) : null}
        </div>
        <Select
          value={value as string | number | undefined}
          options={field.selectOptions}
          onChange={(nextValue) => onFieldChange(field.key, nextValue)}
          className="w-full"
        />
      </div>
    );
  }

  if (field.kind === 'string') {
    return (
      <div className="space-y-2 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <SettingText title={title} description={field.description} dirty={isDirty} />
          {isDirty && onRevert ? (
            <button
              type="button"
              onClick={() => onRevert(field.key)}
              className="shrink-0 pt-1 text-xs font-medium text-text-muted enabled:hover:text-text-primary disabled:text-text-disabled disabled:cursor-not-allowed"
            >
              Revert
            </button>
          ) : null}
        </div>
        <Input
          value={String(value ?? '')}
          onChange={(nextValue) => onFieldChange(field.key, nextValue)}
          size="md"
        />
      </div>
    );
  }

  if (field.kind === 'textarea') {
    return (
      <div className="space-y-2 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <SettingText title={title} description={field.description} dirty={isDirty} />
          {isDirty && onRevert ? (
            <button
              type="button"
              onClick={() => onRevert(field.key)}
              className="shrink-0 pt-1 text-xs font-medium text-text-muted enabled:hover:text-text-primary disabled:text-text-disabled disabled:cursor-not-allowed"
            >
              Revert
            </button>
          ) : null}
        </div>
        <textarea
          value={String(value ?? '')}
          onChange={(event) => onFieldChange(field.key, event.target.value)}
          rows={5}
          className={cn(
            'w-full rounded-sm border border-border-input bg-background px-3 py-2 text-sm text-text-primary transition-colors',
            'focus-visible:border-border-focus focus-visible:ring-1 focus-visible:ring-border-focus focus-visible:outline-none',
            'placeholder:text-text-placeholder',
          )}
        />
      </div>
    );
  }

  return null;
}

function SettingControlRow({
  title,
  description,
  dirty,
  control,
}: {
  title: string;
  description?: string;
  dirty?: boolean;
  control: React.ReactNode;
}) {
  return (
    <div className="flex min-h-16 items-center gap-3 px-4 py-3">
      <SettingText title={title} description={description} dirty={dirty} />
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function SettingText({ title, description, dirty }: { title: string; description?: string; dirty?: boolean }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-2">
        <p className="min-w-0 line-clamp-2 text-base font-medium text-text-primary">{title}</p>
        {dirty ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
      </div>
      {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
    </div>
  );
}

function AboutEditor() {
  return (
    <SettingsList label="About">
      <div className="px-4 py-4">
        <p className="text-base font-medium text-text-primary">Taurent</p>
        <p className="mt-1 text-sm text-text-secondary">Version {appBuildMetadata.version}</p>
        {appBuildMetadata.diagnostics.length > 0 ? (
          <p className="mt-1 text-sm text-text-muted">{appBuildMetadata.diagnostics.join(' · ')}</p>
        ) : null}
        <p className="mt-1 text-sm text-text-secondary">A mobile-first Tauri client for qBittorrent.</p>
      </div>
    </SettingsList>
  );
}

function MobileSaveBar({
  isSaving,
  error,
  onDiscard,
  onSave,
}: {
  isSaving: boolean;
  error: string | null;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <div
      className="fixed inset-x-0 z-40 border-t border-border bg-surface-elevated px-2 py-3 shadow-sm"
      style={{ bottom: 'var(--mobile-tab-bar-safe-height, 0px)' }}
    >
      <div className="mx-auto w-full max-w-lg">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-sm font-medium text-text-primary">Unsaved qBittorrent changes</span>
        </div>
        {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" size="md" disabled={isSaving} onClick={onDiscard}>
            Discard
          </Button>
          <Button variant="primary" size="md" loading={isSaving} onClick={onSave}>
            Save All
          </Button>
        </div>
      </div>
    </div>
  );
}

function getSectionTitle(section: MobileSettingsSectionKey) {
  if (section === 'webui') return 'WebUI';
  if (section === 'bittorrent') return 'BitTorrent';
  return section.charAt(0).toUpperCase() + section.slice(1);
}
