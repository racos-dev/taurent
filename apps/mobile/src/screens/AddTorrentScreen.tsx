import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { pickTorrentFiles } from '../platform';
import { useCategories } from '../hooks/useCategories';
import { useTags } from '../hooks/useTags';
import { useAddTorrent } from '../hooks';
import { usePreferences } from '../hooks/useSettings';
import { AddTorrentScreenBody, ScreenHeader } from '@taurent/web-ui';
import { useAddTorrentScreenController } from '@taurent/web-core';
import { mobileScreenRootClassName } from '../ui/mobileScreenLayout';
import { useLocalizedErrorFormatter, useTaurentTranslation } from '@taurent/shared/i18n';

type AddTorrentMode = 'magnet' | 'file';

export function AddTorrentScreen() {
  const { t } = useTaurentTranslation('torrents');
  const formatError = useLocalizedErrorFormatter();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode: AddTorrentMode = searchParams.get('mode') === 'file' ? 'file' : 'magnet';

  const { categories } = useCategories();
  const { tags } = useTags();
  const { preferences } = usePreferences();
  const { addByUrl, addByFiles, isPending } = useAddTorrent();

  // Controller owns form state and submit orchestration.
  // Mobile provides string paths since pickTorrentFiles returns string paths.
  const controller = useAddTorrentScreenController({
    addByUrl,
    addByFiles,
    mode,
    onSubmitSuccess: () => navigate(-1),
    onSubmitError: () => {
      // Error surfaced via controller.error
    },
    formatError: (error) => formatError(error, 'add-torrent'),
    validationMessages: {
      magnetRequired: t('addForm.magnetRequired'),
      invalidMagnet: t('addForm.invalidMagnet'),
      fileRequired: t('addForm.fileRequired'),
    },
  });

  // Populate save path from preferences on mount
  useEffect(() => {
    if (preferences?.save_path) {
      controller.setSavePath(preferences.save_path);
    }
  }, [controller, preferences?.save_path]);

  // Populate magnetUri from URL param when mode is magnet
  useEffect(() => {
    if (mode === 'magnet') {
      const urlParam = searchParams.get('url');
      if (urlParam) {
        controller.setMagnetUri(urlParam);
      }
    }
  }, [mode, searchParams, controller]);

  // Mobile file picker (app-local)
  const handlePickFiles = async () => {
    try {
      const torrentFiles = await pickTorrentFiles();
      if (torrentFiles.length === 0) {
        return;
      }
      controller.setSelectedFiles(torrentFiles);
    } catch (err) {
      controller.setError(formatError(err, 'file-picker'));
    }
  };

  const categoryList = categories ? Object.values(categories).map((c) => c.name) : [];
  const tagList = tags && Array.isArray(tags) ? tags : [];

  return (
    <div className={mobileScreenRootClassName()}>
      <ScreenHeader
        title={t('add')}
        subtitle={t(mode === 'magnet' ? 'addForm.pasteMagnet' : 'addForm.selectTorrentFiles')}
        variant="mobile"
        onBack={() => navigate('/')}
      />

      {/* Shared body */}
      <main className="mx-auto w-full max-w-lg px-2 pb-[calc(5rem+var(--sab))]">
        <AddTorrentScreenBody
          variant="mobile"
          mode={mode}
          onModeChange={(nextMode) => setSearchParams({ mode: nextMode })}
          magnetUri={controller.magnetUri}
          onMagnetUriChange={controller.setMagnetUri}
          fileItems={controller.fileItems}
          onPickFiles={handlePickFiles}
          onRemoveFile={(id) => controller.handleRemoveFile(id)}
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
          error={controller.error}
          isSubmitting={isPending}
          onSubmit={() => {
            if (!controller.validate()) return;
            if (!controller.savePath.trim()) {
              controller.setError(t('addForm.savePathRequired'));
              return;
            }
            void controller.handleSubmit();
          }}
          onCancel={() => navigate(-1)}
        />
      </main>
    </div>
  );
}
