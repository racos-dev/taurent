// Headless controller for AddTorrentScreen orchestration.
//
// Platform-agnostic — does not import @tauri-apps/* or produce UI.
//
// Extracts form state, mode switching, file/tag management, and submit
// orchestration from the desktop/mobile AddTorrentScreen routes into a
// reusable shared hook. UI rendering stays in the app route shell.
//
// Usage (mobile/desktop AddTorrentScreen):
//   const controller = useAddTorrentScreenController({
//     addByUrl,
//     addByFiles,
//     mode,
//     onModeChange,
//     onSubmitSuccess: () => navigate('/'),
//     onSubmitError: (msg) => setError(msg),
//   });

import { useState, useCallback, useRef } from 'react';
import { validateMagnetLink } from '@taurent/shared/schemas/addTorrent';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';

// ─── Local type alias (same as AddTorrentFileItem in web-ui) ─────────────────
export interface AddTorrentFileItem {
  id: string;
  name: string;
  meta?: string;
}

export interface AddTorrentScreenControllerOptions {
  /** Add torrent by URL */
  addByUrl: (url: string, options?: AddTorrentOptionsInput) => Promise<unknown>;
  /** Add torrent by file paths */
  addByFiles: (files: string[], options?: AddTorrentOptionsInput) => Promise<unknown>;
  /** Current input mode */
  mode: 'magnet' | 'file';
  /** Called on successful submit */
  onSubmitSuccess: () => void;
  /** Called on submit error with message */
  onSubmitError: (message: string) => void;
  /**
   * Desktop-only: when true, the controller tracks which source
   * (magnet or file) was last interacted with and submits from that source.
   * Mobile should pass undefined (default behavior uses `mode` prop).
   */
  desktopUnifiedMode?: boolean;
}

export interface AddTorrentOptionsInput {
  savepath?: string;
  category?: string;
  tags?: string;
  sequential_download?: boolean;
  skip_checking?: boolean;
  paused?: boolean;
  root_folder?: boolean;
  rename?: string;
  up_limit?: number;
  dl_limit?: number;
  auto_tmm?: boolean;
  first_last_piece_prio?: boolean;
  content_layout?: 'Original' | 'Subfolder' | 'NoSubfolder';
  stop_condition?: 'none' | 'metadata' | 'files';
  add_to_top?: boolean;
}

export interface AddTorrentScreenControllerResult {
  // ─── Form fields ─────────────────────────────────────────
  magnetUri: string;
  selectedFiles: string[];
  savePath: string;
  category: string;
  selectedTags: string[];
  sequentialDownload: boolean;
  skipChecking: boolean;
  paused: boolean;
  rootFolder: boolean;
  rename: string;
  upLimit: number | null;
  dlLimit: number | null;
  autoTMM: boolean;
  firstLastPiecePrio: boolean;
  contentLayout: 'Original' | 'Subfolder' | 'NoSubfolder';
  stopCondition: 'none' | 'metadata' | 'files';
  addToTop: boolean;

  // ─── Field setters ─────────────────────────────────────
  setMagnetUri: (v: string) => void;
  setSelectedFiles: (v: string[]) => void;
  setSavePath: (v: string) => void;
  setCategory: (v: string) => void;
  setSelectedTags: (v: string[]) => void;
  setSequentialDownload: (v: boolean) => void;
  setSkipChecking: (v: boolean) => void;
  setPaused: (v: boolean) => void;
  setRootFolder: (v: boolean) => void;
  setRename: (v: string) => void;
  setUpLimit: (v: number | null) => void;
  setDlLimit: (v: number | null) => void;
  setAutoTMM: (v: boolean) => void;
  setFirstLastPiecePrio: (v: boolean) => void;
  setContentLayout: (v: 'Original' | 'Subfolder' | 'NoSubfolder') => void;
  setStopCondition: (v: 'none' | 'metadata' | 'files') => void;
  setAddToTop: (v: boolean) => void;
  setError: (msg: string | null) => void;
  clearError: () => void;

  // ─── File items for body ────────────────────────────────
  fileItems: AddTorrentFileItem[];

  // ─── Tag actions ────────────────────────────────────────
  handleToggleTag: (tag: string) => void;
  handleRemoveTag: (tag: string) => void;
  handleRemoveFile: (id: string) => void;

  // ─── Active source (desktop unified mode) ──────────────
  /** null means no explicit interaction yet; submit infers from available data */
  lastUsedSource: 'magnet' | 'file' | null;
  /** Called by UI when user focuses/changes magnet or file source */
  setLastUsedSource: (source: 'magnet' | 'file' | null) => void;
  /** Resolved active source for CTA text — null means neutral, no source highlighted */
  effectiveActiveSource: 'magnet' | 'file' | null;

  // ─── Submit ─────────────────────────────────────────────
  /** Runs source-aware validation (magnet or file); returns true if valid. */
  validate: () => boolean;
  error: string | null;
  isSubmitting: boolean;
  handleSubmit: () => Promise<void>;
}

export function useAddTorrentScreenController({
  addByUrl,
  addByFiles,
  mode,
  onSubmitSuccess,
  onSubmitError,
  desktopUnifiedMode = false,
}: AddTorrentScreenControllerOptions): AddTorrentScreenControllerResult {
  // ─── Form fields ─────────────────────────────────────────
  const [magnetUri, setMagnetUri] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [savePath, setSavePath] = useState('');
  const [category, setCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sequentialDownload, setSequentialDownload] = useState(false);
  const [skipChecking, setSkipChecking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rootFolder, setRootFolder] = useState(true);
  const [rename, setRename] = useState('');
  const [upLimit, setUpLimit] = useState<number | null>(null);
  const [dlLimit, setDlLimit] = useState<number | null>(null);
  const [autoTMM, setAutoTMM] = useState(false);
  const [firstLastPiecePrio, setFirstLastPiecePrio] = useState(false);
  const [contentLayout, setContentLayout] = useState<'Original' | 'Subfolder' | 'NoSubfolder'>('Original');
  const [stopCondition, setStopCondition] = useState<'none' | 'metadata' | 'files'>('none');
  const [addToTop, setAddToTop] = useState(false);

  // ─── Error / submit state ────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);

  // ─── Active source (desktop unified mode) ─────────────
  // null means no explicit interaction yet; submit infers from available data.
  const [lastUsedSource, setLastUsedSource] = useState<'magnet' | 'file' | null>(null);

  // Determine which source to submit from (for desktop unified mode).
  // If lastUsedSource is null, infer from whichever source has data.
  const resolveSubmitSource = useCallback((): 'magnet' | 'file' => {
    if (lastUsedSource) return lastUsedSource;
    if (magnetUri.trim()) return 'magnet';
    if (selectedFiles.length > 0) return 'file';
    return 'magnet'; // fallback; validation will catch empty
  }, [lastUsedSource, magnetUri, selectedFiles]);

  // Effective active source for UI feedback (e.g. which panel is highlighted, CTA text).
  // If no explicit source chosen yet, null means neutral — no source highlighted.
  const effectiveActiveSource: 'magnet' | 'file' | null = lastUsedSource ?? (magnetUri.trim() ? 'magnet' : (selectedFiles.length > 0 ? 'file' : null));

  const clearError = useCallback(() => setError(null), []);

  // ─── File items (derived for body consumption) ───────────
  const fileItems: AddTorrentFileItem[] = selectedFiles.map((file, i) => ({
    id: String(i),
    name: file.split('/').pop() || file,
    meta: file,
  }));

  // ─── Tag actions ─────────────────────────────────────────
  const handleToggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const handleRemoveTag = useCallback((tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleRemoveFile = useCallback((id: string) => {
    setSelectedFiles((prev) => prev.filter((_, i) => String(i) !== id));
  }, []);

  // ─── Build options object ────────────────────────────────
  const buildOptions = useCallback((): AddTorrentOptionsInput => ({
    savepath: savePath || undefined,
    category: category || undefined,
    tags: selectedTags.length > 0 ? selectedTags.join(',') : undefined,
    sequential_download: sequentialDownload,
    skip_checking: skipChecking,
    paused,
    root_folder: rootFolder,
    rename: rename || undefined,
    up_limit: upLimit ?? undefined,
    dl_limit: dlLimit ?? undefined,
    auto_tmm: autoTMM,
    first_last_piece_prio: firstLastPiecePrio,
    content_layout: contentLayout,
    stop_condition: stopCondition,
    add_to_top: addToTop,
  }), [savePath, category, selectedTags, sequentialDownload, skipChecking, paused, rootFolder, rename, upLimit, dlLimit, autoTMM, firstLastPiecePrio, contentLayout, stopCondition, addToTop]);

  // ─── Validation ─────────────────────────────────────────────────────────
  /**
   * Runs source-aware validation (magnet or file) and sets controller error.
   * Returns true if validation passes; false otherwise.
   * Call before handleSubmit() in app wrappers.
   */
  const validate = useCallback((): boolean => {
    clearError();
    const source: 'magnet' | 'file' =
      desktopUnifiedMode ? resolveSubmitSource() : mode;

    if (source === 'magnet') {
      if (!magnetUri.trim()) {
        setError('Please enter a URL or magnet link');
        return false;
      }
      if (!validateMagnetLink(magnetUri.trim())) {
        setError('Invalid URL or magnet format');
        return false;
      }
    } else {
      if (selectedFiles.length === 0) {
        setError('Please select at least one torrent file');
        return false;
      }
    }
    return true;
  }, [desktopUnifiedMode, resolveSubmitSource, mode, magnetUri, selectedFiles, clearError, setError]);

  // ─── Submit ─────────────────────────────────────────────
  const handleSubmit = useCallback(async (): Promise<void> => {
    if (submitInFlightRef.current) {
      return;
    }

    submitInFlightRef.current = true;
    setError(null);
    setIsSubmitting(true);

    try {
      const options = buildOptions();
      const submitSource = desktopUnifiedMode ? resolveSubmitSource() : mode;
      if (submitSource === 'magnet') {
        await addByUrl(magnetUri, options);
      } else {
        await addByFiles(selectedFiles, options);
      }
      onSubmitSuccess();
    } catch (err) {
      const message = formatUserMessageForContext(err, 'add-torrent');
      setError(message);
      onSubmitError(message);
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }, [desktopUnifiedMode, resolveSubmitSource, mode, magnetUri, selectedFiles, addByUrl, addByFiles, buildOptions, onSubmitSuccess, onSubmitError]);

  return {
    magnetUri,
    selectedFiles,
    savePath,
    category,
    selectedTags,
    sequentialDownload,
    skipChecking,
    paused,
    rootFolder,
    rename,
    upLimit,
    dlLimit,
    autoTMM,
    firstLastPiecePrio,
    contentLayout,
    stopCondition,
    addToTop,
    setMagnetUri,
    setSelectedFiles,
    setSavePath,
    setCategory,
    setSelectedTags,
    setSequentialDownload,
    setSkipChecking,
    setPaused,
    setRootFolder,
    setRename,
    setUpLimit,
    setDlLimit,
    setAutoTMM,
    setFirstLastPiecePrio,
    setContentLayout,
    setStopCondition,
    setAddToTop,
    setError,
    clearError,
    fileItems,
    handleToggleTag,
    handleRemoveTag,
    handleRemoveFile,
    validate,
    error,
    isSubmitting,
    handleSubmit,
    lastUsedSource,
    setLastUsedSource,
    effectiveActiveSource,
  };
}
