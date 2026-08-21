import { RetryButton, SettingToggle } from '@taurent/web-ui';
import { SkeletonBlock } from '@taurent/web-ui/components/shared/SkeletonBlock/SkeletonBlock';

interface TaurentDownloadsSettingsProps {
  deleteAddedTorrentFiles: boolean;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onChange: (value: boolean) => void;
}

export function TaurentDownloadsSettings({
  deleteAddedTorrentFiles,
  isLoading,
  error,
  onRetry,
  onChange,
}: TaurentDownloadsSettingsProps) {
  if (isLoading) {
    return (
      <div className="rounded-sm border border-border bg-surface p-4" role="status" aria-label="Loading Taurent download settings">
        <SkeletonBlock height="2rem" background="bg-surface-interactive" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error ? (
        <div className="rounded-sm border border-error bg-error-20 p-3">
          <p className="text-sm font-medium text-error">Taurent download settings unavailable</p>
          <p className="mt-1 text-xs text-text-secondary">{error}</p>
          <RetryButton onClick={onRetry} className="mt-2" />
        </div>
      ) : null}

      <div className="rounded-sm border border-border bg-surface px-2 py-2">
        <p className="mb-2 text-xs font-medium text-text-muted">After adding a torrent</p>
        <SettingToggle
          label="Delete files selected in Taurent after a successful upload"
          description="Deletes the original .torrent files from this device. Files are kept when the upload fails or qBittorrent reports a rejected batch."
          value={deleteAddedTorrentFiles}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
