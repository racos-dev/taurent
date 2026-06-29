export interface DeleteTorrentDialogProps {
  onCancel: () => void;
  onDelete: (deleteFiles: boolean) => void;
  isPending?: boolean;
  /** Number of torrents being deleted, for pluralized messaging. Defaults to 1. */
  count?: number;
}
