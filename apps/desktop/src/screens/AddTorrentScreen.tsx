import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AddTorrentScreenBody } from '@taurent/web-ui';
import { getCapabilityStatus } from '@taurent/web-core/capabilities';
import { useAddTorrent, useCategories, useTags } from '../hooks';
import { useAddTorrentScreenController } from '@taurent/web-core';
import { useQBClient } from '../connection';
import { closeAuxWindow } from '../windows/auxWindowManager';
import { pickTorrentFiles } from '../platform';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';

type AddTorrentMode = 'magnet' | 'file';

interface AddTorrentScreenProps {
  variant?: 'main' | 'aux';
}

export function AddTorrentScreen({ variant = 'main' }: AddTorrentScreenProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Desktop always uses 'magnet' as the base mode for the controller;
  // actual source routing is handled via desktopUnifiedMode + lastUsedSource.
  const mode: AddTorrentMode = 'magnet';

  const { addByUrl, addByFiles, isPending: isSubmitting } = useAddTorrent();
  const { capabilities } = useQBClient();
  const metadataApiStatus = getCapabilityStatus(capabilities, 'supportsMetadataApi');

  const { categories } = useCategories();
  const categoryList = categories ? Object.values(categories).map((c) => c.name) : [];

  const { tags } = useTags();
  const tagList = tags ?? [];

  // Handle success/cancel based on window variant
  const handleSuccess = useCallback(() => {
    if (variant === 'aux') {
      void closeAuxWindow('add-torrent');
    } else {
      navigate('/');
    }
  }, [variant, navigate]);

  const handleCancel = useCallback(() => {
    if (variant === 'aux') {
      void closeAuxWindow('add-torrent');
    } else {
      navigate('/');
    }
  }, [variant, navigate]);

  // Controller owns form state and submit orchestration.
  // desktopUnifiedMode=true makes the controller submit from lastUsedSource.
  const controller = useAddTorrentScreenController({
    addByUrl,
    addByFiles,
    mode,
    desktopUnifiedMode: true,
    onSubmitSuccess: handleSuccess,
    onSubmitError: () => {
      // Error is surfaced via controller.error
    },
  });

  // Sync magnetUri from URL param on mount (for magnet-link shortcuts and singleton re-use)
  useEffect(() => {
    const urlParam = searchParams.get('url');
    if (urlParam) {
      controller.setMagnetUri(urlParam);
      controller.setLastUsedSource('magnet');
    }
  }, [searchParams, controller]);

  // Handle source=link param from tray "Add Torrent Link..." action so the
  // screen starts in the URL/magnet entry path without disrupting existing
  // url/files query behavior.
  useEffect(() => {
    const sourceParam = searchParams.get('source');
    if (sourceParam === 'link') {
      controller.setLastUsedSource('magnet');
    }
  }, [searchParams, controller]);

  // Stable filesParam derived from searchParams so the effect deps are predictable
  const filesParam = searchParams.get('files') ?? null;

  // Track the last filesParam value we've acted on so we don't re-apply
  // the same param after the user has already modified the file list.
  const lastFilesParamRef = useRef<string | null>(null);

  // Sync torrent file paths from `files` search param (from OS file-open flow).
  // Guards:
  //  - Only re-runs when filesParam changes, not on every controller re-render.
  //  - Skips if we already handled this exact param value (prevents loops on searchParams re-set).
  //  - Validates each item is a non-empty string before setting.
  //  - Skips if the parsed paths are identical to what the controller already holds.
  //  - Only depends on stable controller methods, not the controller object itself.
  /* eslint-disable react-hooks/exhaustive-deps -- intentional: we depend only
     on stable controller methods; adding the controller object would cause spurious re-runs. */
  useEffect(() => {
    if (filesParam === null) return;
    if (filesParam === lastFilesParamRef.current) return;
    lastFilesParamRef.current = filesParam;

    try {
      const parsed: unknown = JSON.parse(filesParam);
      if (!Array.isArray(parsed)) return;
      const paths = parsed.filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
      if (paths.length === 0) return;

      // Avoid resetting state if user has already modified the list
      const current = controller.selectedFiles;
      if (paths.length === current.length && paths.every((p, i) => p === current[i])) {
        return;
      }

      controller.setSelectedFiles(paths);
      controller.setLastUsedSource('file');
    } catch {
      // Invalid JSON — ignore
    }
  }, [filesParam, controller.setSelectedFiles, controller.setLastUsedSource]);

  // Desktop file picker using native OS dialog via platform helper
  const handlePickFiles = useCallback(async () => {
    try {
      const files = await pickTorrentFiles();
      if (files.length === 0) return;
      controller.setSelectedFiles([...new Set([...controller.selectedFiles, ...files])]);
      controller.setLastUsedSource('file');
    } catch (err) {
      controller.setError(formatUserMessageForContext(err, 'file-picker'));
    }
  }, [controller]);

  const handleMagnetUriChange = useCallback((value: string) => {
    controller.setMagnetUri(value);

    if (value.trim()) {
      controller.setLastUsedSource('magnet');
      return;
    }

    if (controller.selectedFiles.length > 0 && controller.lastUsedSource === 'magnet') {
      controller.setLastUsedSource('file');
    }
  }, [controller]);

  const handleRemoveFile = useCallback((id: string) => {
    const willRemoveLastFile = controller.fileItems.length === 1 && controller.fileItems[0]?.id === id;

    controller.handleRemoveFile(id);

    if (willRemoveLastFile && controller.magnetUri.trim()) {
      controller.setLastUsedSource('magnet');
    }
  }, [controller]);

  // Desktop submit delegates to controller after validation
  const handleSubmit = useCallback(async () => {
    if (!controller.validate()) return;
    await controller.handleSubmit();
  }, [controller]);

  return (
      <div className="h-full flex flex-col bg-background">
        {/* Shared body — desktop unified layout */}
        <AddTorrentScreenBody
          variant="desktop"
          desktopUnifiedMode={true}
          mode={mode}
          onModeChange={() => { /* no-op in unified mode */ }}
          magnetUri={controller.magnetUri}
          onMagnetUriChange={handleMagnetUriChange}
          fileItems={controller.fileItems}
          onPickFiles={handlePickFiles}
          onRemoveFile={handleRemoveFile}
          savePath={controller.savePath}
          onSavePathChange={controller.setSavePath}
          category={controller.category}
          onCategoryChange={controller.setCategory}
          categories={categoryList}
          selectedTags={controller.selectedTags}
          onToggleTag={controller.handleToggleTag}
          onRemoveTag={controller.handleRemoveTag}
          tags={tagList}
          sequentialDownload={controller.sequentialDownload}
          onSequentialDownloadChange={controller.setSequentialDownload}
          skipChecking={controller.skipChecking}
          onSkipCheckingChange={controller.setSkipChecking}
          paused={controller.paused}
          onPausedChange={controller.setPaused}
          rootFolder={controller.rootFolder}
          onRootFolderChange={controller.setRootFolder}
          rename={controller.rename}
          onRenameChange={controller.setRename}
          upLimit={controller.upLimit}
          onUpLimitChange={controller.setUpLimit}
          dlLimit={controller.dlLimit}
          onDlLimitChange={controller.setDlLimit}
          autoTMM={controller.autoTMM}
          onAutoTMMChange={controller.setAutoTMM}
          firstLastPiecePrio={controller.firstLastPiecePrio}
          onFirstLastPiecePrioChange={controller.setFirstLastPiecePrio}
          contentLayout={controller.contentLayout}
          onContentLayoutChange={controller.setContentLayout}
          stopCondition={controller.stopCondition}
          onStopConditionChange={controller.setStopCondition}
          supportsMetadataApi={metadataApiStatus.enabled}
          addToTop={controller.addToTop}
          onAddToTopChange={controller.setAddToTop}
          error={controller.error}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          lastUsedSource={controller.effectiveActiveSource}
          onLastUsedSourceChange={controller.setLastUsedSource}
        />
      </div>
    );
}
