/**
 * Desktop Search Screen - Phase 6.
 *
 * Wires the shared SearchScreenBody to desktop-specific data sources
 * (useSearchScreenModel from web-core + useQBClient for capability).
 */

import { SearchScreenBody } from '@taurent/web-ui';
import { useQBClient } from '../connection';
import { useSearchScreenModel, createSearchAdapters } from '@taurent/web-core';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { openAddTorrentWindow } from '../windows/dialogs/addTorrentWindow';

export function SearchScreen() {
  const { serverId, sessionGeneration, isConnected, capabilities } = useQBClient();

  const model = useSearchScreenModel({
    scope: { serverId, sessionGeneration, isConnected },
    capabilities,
    adapters: createSearchAdapters(BridgeAdapter.qBClient),
    onAddResult: async (result) => {
      // Open add-torrent aux window with the search result URL prefilled
      await openAddTorrentWindow({ mode: 'magnet', url: result.fileUrl });
    },
  });

  return (
    <div className="flex h-full flex-col bg-background">
      <SearchScreenBody
        variant="desktop"
        isSupported={model.isSupported}
        isUnsupported={model.isUnsupported}
        isCapabilityLoading={model.isCapabilityLoading}
        query={model.query}
        onQueryChange={model.setQuery}
        selectedCategory={model.selectedCategory}
        onCategoryChange={model.setSelectedCategory}
        selectedPlugins={model.selectedPlugins}
        onPluginsChange={model.setSelectedPlugins}
        isSearching={model.isSearching}
        searchError={model.searchError}
        onStartSearch={model.onStartSearch}
        onStopSearch={model.onStopSearch}
        searchResults={model.searchResults}
        currentResultsTotal={model.currentResultsTotal}
        isLoadingResults={model.isLoadingResults}
        plugins={model.plugins}
        isLoadingPlugins={model.isLoadingPlugins}
        pluginsError={model.pluginsError}
        isPluginActionPending={model.isPluginActionPending}
        onEnablePlugin={model.onEnablePlugin}
        onUninstallPlugin={model.onUninstallPlugin}
        onInstallPlugin={model.onInstallPlugin}
        onUpdatePlugins={model.onUpdatePlugins}
        onAddResult={model.onAddResult}
      />
    </div>
  );
}
