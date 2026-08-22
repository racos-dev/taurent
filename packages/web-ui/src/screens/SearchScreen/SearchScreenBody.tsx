import React, { useCallback, useEffect, useState } from 'react';
import { cn, Icon } from '@taurent/shared';
import { ExternalLink } from '../../components/shared/ExternalLink';
import { StateSurface } from '../../components/shared/StateSurface';
import { SkeletonBlock } from '../../components/shared/SkeletonBlock';
import { ConfirmDialog } from '../../components/dialogs/ConfirmDialog';
import { Input } from '../../components/primitives/Input';
import { Select } from '../../components/primitives/Select';
import { PluginInstallDialog } from '../../components/dialogs/PluginInstallDialog';
import {
  filledVariantClasses,
  surfaceVariantClasses,
} from '../../components/primitives/buttonStyles';
import { useLocalizedFormatters, useTaurentTranslation } from '@taurent/shared/i18n';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NormalizedSearchPlugin {
  name: string;
  fullName: string;
  version: string;
  enabled: boolean;
  url: string;
  supportedCategories: Array<{ id: string; name: string }>;
}

export interface NormalizedSearchResult {
  descrLink: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  nbLeechers: number;
  nbSeeders: number;
  siteUrl: string;
}

export type SearchSortKey = 'seeders' | 'leechers' | 'size' | 'name';
export type SearchSortDirection = 'asc' | 'desc';

const SORT_KEY_OPTIONS = [
  { value: 'seeders', labelKey: 'seeders' },
  { value: 'leechers', labelKey: 'leechers' },
  { value: 'size', labelKey: 'size' },
  { value: 'name', labelKey: 'name' },
] as const;

export interface SearchScreenProps {
  variant?: 'desktop' | 'mobile';
  // Capability state
  isSupported: boolean | null;
  isUnsupported: boolean;
  isCapabilityLoading: boolean;
  // Query state
  query: string;
  onQueryChange: (query: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  selectedPlugins: string[];
  onPluginsChange: (plugins: string[]) => void;
  // Actions
  isSearching: boolean;
  searchError: string | null;
  onStartSearch: (currentQuery: string) => void;
  onStopSearch: () => void;
  // Results
  searchResults: NormalizedSearchResult[];
  currentResultsTotal: number;
  isLoadingResults: boolean;
  // Result ordering (optional; when omitted, the sort control is hidden)
  sortKey?: SearchSortKey;
  sortDirection?: SearchSortDirection;
  onSortKeyChange?: (key: SearchSortKey) => void;
  onSortDirectionChange?: (direction: SearchSortDirection) => void;
  // Plugins
  plugins: NormalizedSearchPlugin[];
  isLoadingPlugins: boolean;
  pluginsError: string | null;
  isPluginActionPending: boolean;
  onEnablePlugin: (name: string, enable: boolean) => void;
  onUninstallPlugin: (name: string) => void;
  onInstallPlugin: (sourceUrl: string) => void;
  onUpdatePlugins: () => void;
  // Add to downloads callback
  onAddResult?: (result: NormalizedSearchResult) => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SearchResultRowProps {
  result: NormalizedSearchResult;
  onAdd: () => void;
}

const SearchResultRow = React.memo<SearchResultRowProps>(({ result, onAdd }) => {
  const { t } = useTaurentTranslation('search');
  const format = useLocalizedFormatters();
  return (
  <div className="flex items-start gap-2 rounded-sm border border-border bg-surface px-3 py-2 transition-colors hover:bg-surface-interactive">
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-2">
        <h3
          className="text-xs font-medium text-text-primary overflow-hidden"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
          title={result.fileName}
        >
          {result.fileName || t('unknownResult')}
        </h3>
        <button
          onClick={onAdd}
          className={cn(
            'ml-2 shrink-0 rounded-sm px-2 py-1 text-xs font-medium',
            filledVariantClasses(
              'bg-primary',
              'text-text-on-primary',
              'enabled:hover:bg-primary/90',
              'enabled:active:opacity-90',
            ),
          )}
        >
          {t('add')}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary">
        <span>{format.formatBytes(result.fileSize)}</span>
        <span>{t('seedersValue', { count: format.formatCount(result.nbSeeders) })}</span>
        <span>{t('leechersValue', { count: format.formatCount(result.nbLeechers) })}</span>
      </div>
      {result.siteUrl ? (
        <ExternalLink
          href={result.siteUrl}
          className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Icon name="external-link" className="h-3 w-3" />
          {result.siteUrl}
        </ExternalLink>
      ) : null}
    </div>
  </div>
  );
});

SearchResultRow.displayName = 'SearchResultRow';

interface SortControlProps {
  sortKey: SearchSortKey;
  sortDirection: SearchSortDirection;
  onSortKeyChange: (key: SearchSortKey) => void;
  onSortDirectionChange: (direction: SearchSortDirection) => void;
}

const SortControl = React.memo<SortControlProps>(
  ({ sortKey, sortDirection, onSortKeyChange, onSortDirectionChange }) => {
    const { t } = useTaurentTranslation('search');
    const isDescending = sortDirection === 'desc';
    return (
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-text-muted">{t('sort')}</span>
        <Select<SearchSortKey>
          options={SORT_KEY_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
          value={sortKey}
          onChange={onSortKeyChange}
          containerClassName="w-28"
          aria-label={t('sortBy')}
        />
        <button
          type="button"
          onClick={() => onSortDirectionChange(isDescending ? 'asc' : 'desc')}
          aria-label={t(isDescending ? 'descendingDescription' : 'ascendingDescription')}
          title={t(isDescending ? 'descending' : 'ascending')}
          className={cn(
            'flex shrink-0 items-center justify-center rounded-sm p-2 text-text-secondary',
            surfaceVariantClasses({ border: 'border-border', hoverBg: 'bg-surface-interactive' }),
          )}
        >
          <Icon name={isDescending ? 'chevron-down' : 'chevron-up'} className="h-4 w-4" />
        </button>
      </div>
    );
  },
);

SortControl.displayName = 'SortControl';

interface PluginCardProps {
  plugin: NormalizedSearchPlugin;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  onUninstall: () => void;
  isPending: boolean;
}

const PluginCard = React.memo<PluginCardProps>(({ plugin, isEnabled, onToggle, onUninstall, isPending }) => {
  const { t } = useTaurentTranslation('search');
  return (
  <div className="flex items-center gap-2 rounded-sm border border-border bg-surface px-3 py-2">
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span title={plugin.fullName || plugin.name} className="text-sm font-medium text-text-primary truncate">{plugin.fullName || plugin.name}</span>
        {plugin.version ? (
          <span className="shrink-0 rounded-sm bg-surface-interactive px-1 text-xs text-text-secondary">
            {t('version', { version: plugin.version })}
          </span>
        ) : null}
      </div>
      {plugin.url ? (
        <ExternalLink
          href={plugin.url}
          className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Icon name="external-link" className="h-3 w-3" />
          {plugin.url}
        </ExternalLink>
      ) : null}
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={() => onToggle(!isEnabled)}
        disabled={isPending}
        className={cn(
          'rounded-sm px-2 py-1 text-xs font-medium transition-colors disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled disabled:cursor-not-allowed',
          isEnabled
            ? 'bg-primary/10 text-primary enabled:hover:bg-primary/20'
            : 'bg-surface-interactive text-text-secondary enabled:hover:bg-surface-elevated',
          isPending && 'opacity-50'
        )}
      >
        {t(isEnabled ? 'enabled' : 'disabled')}
      </button>
      <button
        onClick={onUninstall}
        disabled={isPending}
        className="rounded-sm bg-error/10 px-2 py-1 text-xs font-medium text-error enabled:hover:bg-error/20 disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled disabled:cursor-not-allowed"
      >
        {t('remove')}
      </button>
    </div>
  </div>
  );
});

PluginCard.displayName = 'PluginCard';

// ---------------------------------------------------------------------------
// Main SearchScreenBody
// ---------------------------------------------------------------------------

export const SearchScreenBody = React.memo<SearchScreenProps>(({
  variant = 'desktop',
  isSupported,
  isUnsupported,
  isCapabilityLoading,
  query,
  onQueryChange,
  selectedCategory: _selectedCategory,
  onCategoryChange: _onCategoryChange,
  selectedPlugins: _selectedPlugins,
  onPluginsChange: _onPluginsChange,
  isSearching,
  searchError,
  onStartSearch,
  onStopSearch,
  searchResults,
  currentResultsTotal,
  isLoadingResults,
  sortKey,
  sortDirection,
  onSortKeyChange,
  onSortDirectionChange,
  plugins,
  isLoadingPlugins,
  pluginsError,
  isPluginActionPending,
  onEnablePlugin,
  onUninstallPlugin,
  onInstallPlugin,
  onUpdatePlugins,
  onAddResult,
}) => {
  const { t } = useTaurentTranslation('search');
  const [showPlugins, setShowPlugins] = useState(false);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [uninstallTarget, setUninstallTarget] = useState<string | null>(null);
  const [localQuery, setLocalQuery] = useState(query);

  // Keep localQuery in sync when the query prop changes (e.g., external clears)
  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  const handleCloseInstallDialog = useCallback(() => {
    setShowInstallDialog(false);
  }, []);

  // Capability states
  if (isCapabilityLoading) {
    return (
      <StateSurface
        tone="loading"
        title={t('checking')}
        message={t('checkingMessage')}
        icon={<Icon name="search" className="h-6 w-6" />}
      />
    );
  }

  if (isUnsupported) {
    return (
      <StateSurface
        tone="unsupported"
        title={t('unsupported')}
        message={t('unsupportedMessage')}
        icon={<Icon name="search" className="h-6 w-6" />}
      />
    );
  }

  if (isSupported === null) {
    return (
      <StateSurface
        tone="offline"
        title={t('unavailable')}
        message={t('unavailableMessage')}
        icon={<Icon name="search" className="h-6 w-6" />}
      />
    );
  }

  const handleQuerySubmit = (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    const trimmed = localQuery.trim();
    if (!trimmed) return;
    // Pass the current input directly to avoid stale-closure issues with onStartSearch
    onQueryChange(trimmed);
    onStartSearch(trimmed);
  };

  const handleAddResult = (result: NormalizedSearchResult) => {
    onAddResult?.(result);
  };

  const isCompact = variant === 'mobile';

  return (
    <div className={cn('flex flex-col bg-background', isCompact ? 'min-h-screen pb-20' : 'h-full')}>
      {/* Search Input Section */}
      <div className={cn('border-b border-border bg-surface', isCompact ? 'sticky top-0 z-10 px-4 py-3' : 'p-4')}>
        <form onSubmit={handleQuerySubmit} className="flex flex-col gap-3">
          <div className="flex items-stretch gap-2">
            <div className="relative flex-1">
              <Input
                type="text"
                size="sm"
                clearable
                value={localQuery}
                onChange={setLocalQuery}
                placeholder={t('placeholder')}
                icon={<Icon name="search" className="h-4 w-4 text-text-muted" />}
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !localQuery.trim()}
              className={cn(
                'rounded-sm px-3 text-xs font-medium',
                filledVariantClasses(
                  'bg-primary',
                  'text-text-on-primary',
                  'enabled:hover:bg-primary/90',
                  'enabled:active:opacity-90',
                ),
              )}
            >
              {isSearching ? t('searching') : t('search')}
            </button>
            {isSearching && (
              <button
                type="button"
                onClick={onStopSearch}
                className={cn(
                  'rounded-sm px-3 text-xs font-medium',
                  surfaceVariantClasses({ border: 'border-border', hoverBg: 'bg-surface-interactive' }),
                )}
              >
                {t('stop')}
              </button>
            )}
          </div>

          {searchError && (
            <div className="rounded-sm bg-error/10 px-2 py-1 text-xs text-error">
              {t('searchFailed')}
            </div>
          )}

          {/* Plugin toggle */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowPlugins(!showPlugins)}
              className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
            >
              <Icon name={showPlugins ? 'chevron-up' : 'chevron-down'} className="h-4 w-4" />
              {t(showPlugins ? 'hidePlugins' : 'managePlugins')}
            </button>
            {plugins.length > 0 && (
              <span className="text-xs text-text-muted">{t('pluginsAvailable', { count: plugins.length })}</span>
            )}
          </div>
        </form>
      </div>

      {/* Plugin Management Section */}
      {showPlugins && (
        <div className={cn('border-b border-border bg-surface/50', isCompact ? 'px-4 py-3' : 'p-4')}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">{t('pluginsTitle')}</h3>
          <div className="flex gap-2">
              <button
                onClick={() => setShowInstallDialog(true)}
                className="rounded-sm bg-primary/10 px-2 py-1 text-xs font-medium text-primary enabled:hover:bg-primary/20 disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled disabled:cursor-not-allowed"
              >
                {t('install')}
              </button>
              <button
                onClick={onUpdatePlugins}
                disabled={isPluginActionPending}
                className="rounded-sm bg-surface-interactive px-2 py-1 text-xs font-medium text-text-secondary enabled:hover:bg-surface-elevated disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled disabled:cursor-not-allowed"
              >
                {t('updateAll')}
              </button>
            </div>
          </div>

          {pluginsError && (
            <div className="mb-2 rounded-sm bg-error/10 px-2 py-1 text-xs text-error">
              {t('pluginsFailed')}
            </div>
          )}

          {isLoadingPlugins ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <SkeletonBlock key={i} height={16} radius="sm" background="bg-surface-interactive" />
              ))}
            </div>
          ) : plugins.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border py-4 text-center">
              <Icon name="search" className="mx-auto h-6 w-6 text-text-muted" />
              <p className="mt-2 text-xs text-text-secondary">{t('noPlugins')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {plugins.map((plugin) => (
                <PluginCard
                  key={plugin.name}
                  plugin={plugin}
                  isEnabled={plugin.enabled}
                  onToggle={(enabled) => onEnablePlugin(plugin.name, enabled)}
                  onUninstall={() => setUninstallTarget(plugin.name)}
                  isPending={isPluginActionPending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results Section */}
      <div className="flex-1 overflow-auto overscroll-none">
        {isLoadingResults ? (
          <div className={cn('space-y-2', isCompact ? 'p-4' : 'p-4')}>
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonBlock key={i} height={20} radius="sm" background="bg-surface-interactive" />
            ))}
          </div>
        ) : searchResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Icon name="search" className="h-8 w-8 text-text-muted" />
            <p className="mt-3 text-sm text-text-secondary">
              {isSearching ? t('searching') : t('noResults')}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {isSearching
                ? t('resultsSoFar', { count: currentResultsTotal })
                : t('queryHint')}
            </p>
          </div>
        ) : (
          <div className={cn('space-y-2', isCompact ? 'p-4' : 'p-4')}>
            <div className="mb-2 flex items-center justify-between gap-2">
              {currentResultsTotal > 0 && !isSearching ? (
                <p className="text-xs text-text-muted">
                  {t('resultsFound', { count: currentResultsTotal })}
                </p>
              ) : (
                <span aria-hidden="true" />
              )}
              {sortKey && sortDirection && onSortKeyChange && onSortDirectionChange ? (
                <SortControl
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSortKeyChange={onSortKeyChange}
                  onSortDirectionChange={onSortDirectionChange}
                />
              ) : null}
            </div>
            {searchResults.map((result, index) => (
              <SearchResultRow
                key={`${result.fileName}-${index}`}
                result={result}
                onAdd={() => handleAddResult(result)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Install Plugin Dialog */}
      <PluginInstallDialog
        isOpen={showInstallDialog}
        onClose={handleCloseInstallDialog}
        onInstall={onInstallPlugin}
      />

      {/* Uninstall Confirm Dialog */}
      {uninstallTarget && (
        <ConfirmDialog
          title={t('uninstallTitle')}
          message={t('uninstallMessage', { name: uninstallTarget })}
          confirmLabel={t('uninstall')}
          onConfirm={() => {
            onUninstallPlugin(uninstallTarget);
            setUninstallTarget(null);
          }}
          onCancel={() => setUninstallTarget(null)}
          tone="danger"
        />
      )}
    </div>
  );
});

SearchScreenBody.displayName = 'SearchScreenBody';
