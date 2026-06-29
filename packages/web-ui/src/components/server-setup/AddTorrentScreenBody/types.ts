export interface AddTorrentFileItem {
  id: string;
  name: string;
  meta?: string;
}

export interface AddTorrentScreenBodyProps {
  variant?: 'mobile' | 'desktop';
  mode: 'magnet' | 'file';
  onModeChange: (mode: 'magnet' | 'file') => void;
  // Active source tracking (desktop unified mode)
  lastUsedSource?: 'magnet' | 'file' | null;
  onLastUsedSourceChange?: (source: 'magnet' | 'file' | null) => void;
  /** When true, the desktop UI renders as a unified layout with no mode tab switcher */
  desktopUnifiedMode?: boolean;
  // Source
  magnetUri: string;
  onMagnetUriChange: (value: string) => void;
  fileItems: AddTorrentFileItem[];
  onPickFiles: () => void;
  onRemoveFile: (id: string) => void;
  // Destination
  savePath: string;
  onSavePathChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  categories: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  tags: string[];
  // Options
  sequentialDownload: boolean;
  onSequentialDownloadChange: (value: boolean) => void;
  skipChecking: boolean;
  onSkipCheckingChange: (value: boolean) => void;
  paused: boolean;
  onPausedChange: (value: boolean) => void;
  rootFolder: boolean;
  onRootFolderChange: (value: boolean) => void;
  // Desktop-only extended options (optional for mobile)
  rename?: string;
  onRenameChange?: (value: string) => void;
  upLimit?: number | null;
  onUpLimitChange?: (value: number | null) => void;
  dlLimit?: number | null;
  onDlLimitChange?: (value: number | null) => void;
  autoTMM?: boolean;
  onAutoTMMChange?: (value: boolean) => void;
  firstLastPiecePrio?: boolean;
  onFirstLastPiecePrioChange?: (value: boolean) => void;
  contentLayout?: 'Original' | 'Subfolder' | 'NoSubfolder';
  onContentLayoutChange?: (value: 'Original' | 'Subfolder' | 'NoSubfolder') => void;
  stopCondition?: 'none' | 'metadata' | 'files';
  onStopConditionChange?: (value: 'none' | 'metadata' | 'files') => void;
  addToTop?: boolean;
  onAddToTopChange?: (value: boolean) => void;
  // State
  error: string | null;
  isSubmitting: boolean;
  // Actions
  onSubmit: () => void;
  onCancel?: () => void;
}
