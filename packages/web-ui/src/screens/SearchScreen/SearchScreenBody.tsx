import React, { useCallback, useEffect, useState } from 'react';
import { cn, formatBytes, Icon } from '@taurent/shared';
import { StateSurface } from '../../components/shared/StateSurface';
import { SkeletonBlock } from '../../components/shared/SkeletonBlock';
import { ConfirmDialog } from '../../components/dialogs/ConfirmDialog';
import { Input } from '../../components/primitives/Input';
import { PluginInstallDialog } from '../../components/dialogs/PluginInstallDialog';
import {
  filledVariantClasses,
  surfaceVariantClasses,
} from '../../components/primitives/buttonStyles';

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

const SearchResultRow = React.memo<SearchResultRowProps>(({ result, onAdd }) => (
  <div className="flex items-start gap-2 rounded-sm border border-border bg-surface px-3 py-2 transition-colors hover:bg-surface-interactive">
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-2">
        <h3
          className="text-xs font-medium text-text-primary overflow-hidden"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
          title={result.fileName}
        >
          {result.fileName || 'Unknown'}
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
          Add
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary">
        <span>{formatBytes(result.fileSize)}</span>
        <span>Seeders: {result.nbSeeders}</span>
        <span>Leechers: {result.nbLeechers}</span>
      </div>
      {result.siteUrl ? (
        <a
          href={result.siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
          onClick={(e) => { e.stopPropagation(); }}
        >
          <Icon name="external-link" className="h-3 w-3" />
          {result.siteUrl}
        </a>
      ) : null}
    </div>
  </div>
));

SearchResultRow.displayName = 'SearchResultRow';

interface PluginCardProps {
  plugin: NormalizedSearchPlugin;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  onUninstall: () => void;
  isPending: boolean;
}

const PluginCard = React.memo<PluginCardProps>(({ plugin, isEnabled, onToggle, onUninstall, isPending }) => (
  <div className="flex items-center gap-2 rounded-sm border border-border bg-surface px-3 py-2">
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span title={plugin.fullName || plugin.name} className="text-sm font-medium text-text-primary truncate">{plugin.fullName || plugin.name}</span>
        {plugin.version ? (
          <span className="shrink-0 rounded-sm bg-surface-interactive px-1 text-xs text-text-secondary">
            v{plugin.version}
          </span>
        ) : null}
      </div>
      {plugin.url ? (
        <a
          href={plugin.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Icon name="external-link" className="h-3 w-3" />
          {plugin.url}
        </a>
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
        {isEnabled ? 'Enabled' : 'Disabled'}
      </button>
      <button
        onClick={onUninstall}
        disabled={isPending}
        className="rounded-sm bg-error/10 px-2 py-1 text-xs font-medium text-error enabled:hover:bg-error/20 disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled disabled:cursor-not-allowed"
      >
        Remove
      </button>
    </div>
  </div>
));

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
        title="Checking search capability..."
        message="Please wait while we check if your server supports search."
        icon={<Icon name="search" className="h-6 w-6" />}
      />
    );
  }

  if (isUnsupported) {
    return (
      <StateSurface
        tone="unsupported"
        title="Search not available"
        message="Your qBittorrent server does not support search plugins, or they have been disabled."
        icon={<Icon name="search" className="h-6 w-6" />}
      />
    );
  }

  if (isSupported === null) {
    return (
      <StateSurface
        tone="offline"
        title="Search unavailable"
        message="Connect to a server to access search."
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
                placeholder="Search for torrents..."
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
              {isSearching ? 'Searching...' : 'Search'}
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
                Stop
              </button>
            )}
          </div>

          {searchError && (
            <div className="rounded-sm bg-error/10 px-2 py-1 text-xs text-error">
              {searchError}
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
              {showPlugins ? 'Hide plugins' : 'Manage plugins'}
            </button>
            {plugins.length > 0 && (
              <span className="text-xs text-text-muted">{plugins.length} plugin(s) available</span>
            )}
          </div>
        </form>
      </div>

      {/* Plugin Management Section */}
      {showPlugins && (
        <div className={cn('border-b border-border bg-surface/50', isCompact ? 'px-4 py-3' : 'p-4')}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Search Plugins</h3>
          <div className="flex gap-2">
              <button
                onClick={() => setShowInstallDialog(true)}
                className="rounded-sm bg-primary/10 px-2 py-1 text-xs font-medium text-primary enabled:hover:bg-primary/20 disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled disabled:cursor-not-allowed"
              >
                Install
              </button>
              <button
                onClick={onUpdatePlugins}
                disabled={isPluginActionPending}
                className="rounded-sm bg-surface-interactive px-2 py-1 text-xs font-medium text-text-secondary enabled:hover:bg-surface-elevated disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled disabled:cursor-not-allowed"
              >
                Update All
              </button>
            </div>
          </div>

          {pluginsError && (
            <div className="mb-2 rounded-sm bg-error/10 px-2 py-1 text-xs text-error">
              {pluginsError}
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
              <p className="mt-2 text-xs text-text-secondary">No search plugins installed</p>
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
              {isSearching ? 'Searching...' : 'No results yet'}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {isSearching
                ? `Found ${currentResultsTotal} result${currentResultsTotal === 1 ? '' : 's'} so far`
                : 'Enter a query and click Search to find torrents'}
            </p>
          </div>
        ) : (
          <div className={cn('space-y-2', isCompact ? 'p-4' : 'p-4')}>
            {currentResultsTotal > 0 && !isSearching && (
              <p className="mb-2 text-xs text-text-muted">
                {currentResultsTotal} result{currentResultsTotal === 1 ? '' : 's'} found
              </p>
            )}
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
          title="Uninstall Plugin"
          message={`Are you sure you want to uninstall "${uninstallTarget}"? This cannot be undone.`}
          confirmLabel="Uninstall"
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
