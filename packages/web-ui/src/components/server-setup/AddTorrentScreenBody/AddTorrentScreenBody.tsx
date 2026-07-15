import React, { useEffect, useState } from 'react';
import { Magnet, File, Folder, Upload, Settings, ChevronDown, X, Check, AlertCircle, ICON_SIZES } from '@taurent/shared';
import { BUTTON_CONTROL_SIZE_CLASSES, HEADER_ICON_BUTTON_SIZE_CLASSES, useControlDensity } from '../../../controlSizing';
import { DialogActions } from '../../dialogs/DialogActions';
import { Checkbox } from '../../primitives/Checkbox';
import { NumberInput } from '../../primitives/NumberInput';
import { Input } from '../../primitives/Input';
import { Select } from '../../primitives/Select';
import { ToggleSwitch } from '../../primitives/ToggleSwitch';
import type { AddTorrentScreenBodyProps } from './types';

export const AddTorrentScreenBody = React.memo<AddTorrentScreenBodyProps>(
  (
    {
      variant = 'mobile',
      mode,
      onModeChange,
      lastUsedSource: _lastUsedSource,
      onLastUsedSourceChange: _onLastUsedSourceChange,
      desktopUnifiedMode: _desktopUnifiedMode = false,
      magnetUri,
      onMagnetUriChange,
      fileItems,
      onPickFiles,
      onRemoveFile,
      savePath,
      onSavePathChange,
      category,
      onCategoryChange,
      categories,
      selectedTags,
      onToggleTag,
      onRemoveTag,
      tags,
      sequentialDownload,
      onSequentialDownloadChange,
      skipChecking,
      onSkipCheckingChange,
      paused,
      onPausedChange,
      rootFolder,
      onRootFolderChange,
      rename = '',
      onRenameChange = () => {},
      upLimit = null,
      onUpLimitChange = () => {},
      dlLimit = null,
      onDlLimitChange = () => {},
      autoTMM = false,
      onAutoTMMChange = () => {},
      firstLastPiecePrio = false,
      onFirstLastPiecePrioChange = () => {},
      contentLayout = 'Original',
      onContentLayoutChange = () => {},
      stopCondition = 'none',
      onStopConditionChange = () => {},
      supportsMetadataApi = true,
      addToTop = false,
      onAddToTopChange = () => {},
      error,
      isSubmitting,
      onSubmit,
      onCancel,
    },
  ) => {
    const isMobile = variant === 'mobile';
    const [showTagsDropdown, setShowTagsDropdown] = useState(false);
    // Read the active control density so the shared button/icon size maps
    // resolve to the correct entry based on the surrounding app shell.
    const density = useControlDensity();
    const smButtonClasses = BUTTON_CONTROL_SIZE_CLASSES[density].sm;
    const headerIconButtonClasses = HEADER_ICON_BUTTON_SIZE_CLASSES[density];

    useEffect(() => {
      if (!supportsMetadataApi && stopCondition === 'metadata') {
        onStopConditionChange('none');
      }
    }, [onStopConditionChange, stopCondition, supportsMetadataApi]);

    if (isMobile) {
      return (
        <div className="flex flex-col gap-4">
          {error && (
            <div className="rounded-sm border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
              {error}
            </div>
          )}

          {/* Mode switcher */}
          <section className="rounded-sm border border-border bg-surface p-1">
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => onModeChange('magnet')}
                className={`flex items-center justify-center gap-2 rounded-sm px-3 font-medium transition-colors ${smButtonClasses} ${
                  mode === 'magnet'
                    ? 'bg-primary text-text-on-primary'
                    : 'text-text-secondary hover:bg-surface-interactive'
                }`}
              >
                <Magnet />
                Magnet Link
              </button>
              <button
                onClick={() => onModeChange('file')}
                className={`flex items-center justify-center gap-2 rounded-sm px-3 font-medium transition-colors ${smButtonClasses} ${
                  mode === 'file'
                    ? 'bg-primary text-text-on-primary'
                    : 'text-text-secondary hover:bg-surface-interactive'
                }`}
              >
                <File />
                Torrent File
              </button>
            </div>
          </section>

          {/* Torrent Source */}
          <section className="rounded-sm border border-border bg-surface p-3">
            <div className="mb-3 flex items-center gap-2 text-text-primary">
              <div className="flex h-6 w-6 items-center justify-center rounded-sm text-primary">
                {mode === 'file' ? <File /> : <Magnet />}
              </div>
              <h2 className="text-xs font-medium">Torrent Source</h2>
            </div>

            {mode === 'magnet' ? (
              <div>
                <textarea
                  value={magnetUri}
                  onChange={(e) => onMagnetUriChange(e.target.value)}
                  placeholder="magnet:?xt=urn:btih:..."
                  className="w-full rounded-sm border border-border bg-surface-interactive px-2 py-2 text-xs text-text-primary placeholder:text-text-muted resize-none outline-none focus-visible:border-primary focus-visible:outline-none transition-colors"
                  rows={4}
                />
              </div>
            ) : (
              <div>
                {!fileItems.length ? (
                  <button
                    onClick={onPickFiles}
                    className="w-full rounded-sm border-2 border-dashed border-border bg-surface-interactive/50 p-4 text-center transition-colors hover:border-primary/50 hover:bg-surface-interactive"
                  >
                    <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-sm bg-primary/10 text-primary">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div className="text-xs font-medium text-text-primary">Select Torrent Files</div>
                    <div className="mt-1 text-xs text-text-secondary">
                      Tap to browse your device
                    </div>
                  </button>
                ) : (
                  <div className="space-y-3">
                    {fileItems.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 rounded-sm border border-border bg-surface-interactive px-3 py-2"
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-sm text-primary">
                          <File className="h-5 w-5" />
                        </div>
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-text-primary" title={file.name}>
                          {file.name}
                        </span>
                        <button
                          onClick={() => onRemoveFile(file.id)}
                          className={`${headerIconButtonClasses} flex items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-error/10 hover:text-error`}
                        >
                          <X />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={onPickFiles}
                      className={`flex w-full items-center justify-center gap-2 rounded-sm border border-dashed border-border px-3 font-medium text-primary transition-colors hover:border-primary/50 hover:bg-surface-interactive ${smButtonClasses}`}
                    >
                      <Upload />
                      Add More Files
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Destination */}
          <section className="rounded-sm border border-border bg-surface p-3">
            <div className="mb-3 flex items-center gap-2 text-text-primary">
              <div className="flex h-6 w-6 items-center justify-center rounded-sm text-primary">
                <Folder />
              </div>
              <h2 className="text-xs font-medium">Destination</h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Save Path</label>
                <Input
                  type="text"
                  value={savePath}
                  onChange={onSavePathChange}
                  placeholder="/downloads"
                />
              </div>

              <Select
                dataTestid="category-select"
                label="Category"
                value={category}
                onChange={(value) => onCategoryChange(value as string)}
                options={[
                  { value: '', label: 'None' },
                  ...categories.map(c => ({ value: c, label: c })),
                ]}
              />
              {tags.length > 0 && (
                <div className="relative">
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Tags</label>
                  <button
                    type="button"
                    onClick={() => setShowTagsDropdown((current) => !current)}
                    className={`flex w-full items-center justify-between rounded-sm border border-border bg-surface-interactive px-3 text-text-primary transition-colors hover:border-primary/50 ${smButtonClasses}`}
                  >
                    <span>
                      {selectedTags.length > 0 ? `${selectedTags.length} selected` : 'None'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-text-muted" />
                  </button>
                  {showTagsDropdown && (
                    <div className="absolute inset-x-0 top-full z-10 mt-2 max-h-48 overflow-auto overscroll-none rounded-sm border border-border bg-surface shadow-lg">
                      {tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => onToggleTag(tag)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-text-primary hover:bg-surface-interactive"
                        >
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
                              selectedTags.includes(tag)
                                ? 'border-primary bg-primary text-text-on-primary'
                                : 'border-border bg-surface'
                            }`}
                          >
                            {selectedTags.includes(tag) && <Check />}
                          </span>
                          <span>{tag}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-sm bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => onRemoveTag(tag)}
                        className="hover:text-primary/70"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Advanced Options */}
          <section className="rounded-sm border border-border bg-surface p-3">
            <div className="mb-3 flex items-center gap-2 text-text-primary">
              <div className="flex h-6 w-6 items-center justify-center rounded-sm text-primary">
                <Settings />
              </div>
              <h2 className="text-xs font-medium">Advanced Options</h2>
            </div>

            <div className="space-y-2">
              <ToggleRow
                label="Sequential Download"
                checked={sequentialDownload}
                onChange={onSequentialDownloadChange}
              />
              <ToggleRow
                label="Skip Hash Checking"
                checked={skipChecking}
                onChange={onSkipCheckingChange}
              />
              <ToggleRow
                label="Start Paused"
                checked={paused}
                onChange={onPausedChange}
              />
              <ToggleRow
                label="Create Root Folder"
                checked={rootFolder}
                onChange={onRootFolderChange}
              />
            </div>
          </section>

          {/* Submit area for mobile - sticky footer handled by shell */}
          <DialogActions
            actions={[
              ...(onCancel
                ? [{ label: 'Cancel', onClick: onCancel, disabled: isSubmitting }]
                : []),
              {
                label: isSubmitting ? 'Adding...' : 'Add Torrent',
                onClick: onSubmit,
                variant: 'primary',
                disabled: isSubmitting,
              },
            ]}
            className="gap-2"
          />
        </div>
      );
    }

    // Desktop variant — dense unified form, both sources visible, all options
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="shrink-0 border-b border-border px-4 py-4">
          <h1 className="text-sm font-semibold text-text-primary">Add Torrent</h1>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-auto px-4 py-4">
          <div className="space-y-4">
            {error && (
              <div className="bg-error/10 border border-error/30 text-error px-4 py-3 rounded-sm flex items-center gap-2 text-sm">
                <AlertCircle size={ICON_SIZES.md} className="shrink-0" />
                {error}
              </div>
            )}

            {/* Torrent Source — both magnet and files visible */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Magnet size={ICON_SIZES.md} className="text-text-secondary" />
                <span className="text-sm font-semibold text-text-secondary">Torrent Source</span>
              </div>

              <div className="space-y-4 rounded-sm border border-border bg-surface p-2">
                {/* Magnet link — always visible */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Magnet Link
                  </label>
                  <textarea
                    value={magnetUri}
                    onChange={(e) => {
                      onMagnetUriChange(e.target.value);
                      if (_onLastUsedSourceChange) _onLastUsedSourceChange('magnet');
                    }}
                    onFocus={() => {
                      if (_onLastUsedSourceChange) _onLastUsedSourceChange('magnet');
                    }}
                    placeholder="magnet:?xt=urn:btih:..."
                    rows={1}
                    className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-primary focus-visible:outline-none disabled:text-text-disabled"
                   />
                </div>

                {/* Divider */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-border" />
                  <span className="text-xs text-text-muted">or</span>
                  <div className="flex-1 border-t border-border" />
                </div>

                {/* File picker */}
                <button
                  type="button"
                  onClick={() => {
                    onPickFiles();
                    if (_onLastUsedSourceChange) _onLastUsedSourceChange('file');
                  }}
                  className="w-full rounded-sm border border-dashed border-border bg-surface px-4 py-4 flex flex-col items-center justify-center gap-2 text-text-muted cursor-pointer transition-colors hover:border-primary hover:text-primary"
                >
                  <Upload size={ICON_SIZES.md} />
                  {fileItems.length === 0 ? (
                    <span className="text-sm font-medium">Click to browse for .torrent files</span>
                  ) : (
                    <span className="text-sm font-medium text-text-primary">
                      {fileItems.length} file{fileItems.length !== 1 ? 's' : ''} selected — click to add more
                    </span>
                  )}
                </button>

                {/* Selected file list */}
                {fileItems.length > 0 && (
                  <div className="mt-2 max-h-32 overflow-auto overscroll-none rounded-sm border border-border bg-background">
                    {fileItems.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 px-3 py-2 border-b border-border last:border-b-0"
                      >
                        <File size={ICON_SIZES.md} className="text-primary shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-sm text-text-primary" title={file.name}>
                          {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveFile(file.id)}
                          className="flex items-center justify-center h-5 w-5 rounded-sm text-text-muted transition-colors hover:bg-error/10 hover:text-error"
                        >
                          <X size={ICON_SIZES.sm} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                </div>
              </section>

            {/* Options — dense 2-column + full-width form */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Folder size={ICON_SIZES.md} className="text-text-secondary" />
                <span className="text-sm font-semibold text-text-secondary">Options</span>
              </div>

              <div className="rounded-sm border border-border bg-surface p-2 space-y-4">
                {/* Torrent Management Mode */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Torrent Management Mode
                  </label>
                  <Select
                    value={autoTMM ? 'auto' : 'manual'}
                    onChange={(value) => onAutoTMMChange(value === 'auto')}
                    options={[
                      { value: 'auto', label: 'Automatic' },
                      { value: 'manual', label: 'Manual' },
                    ]}
                  />
                </div>

                {/* Main options grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {/* Save Path */}
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-medium text-text-secondary">
                      Save files to location
                    </label>
                    <Input
                      type="text"
                      value={savePath}
                      onChange={onSavePathChange}
                      placeholder="Default download path"
                    />
                  </div>

                  {/* Rename */}
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-medium text-text-secondary">
                      Rename torrent
                    </label>
                    <Input
                      type="text"
                      value={rename}
                      onChange={onRenameChange}
                      placeholder="Optional"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">
                      Category
                    </label>
                    <Select
                      dataTestid="category-select"
                      value={category}
                      onChange={(value) => onCategoryChange(value as string)}
                      options={[
                        { value: '', label: 'None' },
                        ...categories.map(c => ({ value: c, label: c })),
                      ]}
                    />
                  </div>

                  {/* Stop Condition */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">
                      Stop Condition
                    </label>
                    <Select
                      value={stopCondition}
                      onChange={(value) => onStopConditionChange(value as 'none' | 'metadata' | 'files')}
                      options={[
                        { value: 'none', label: 'None' },
                        ...(supportsMetadataApi ? [{ value: 'metadata', label: 'Metadata received' }] : []),
                        { value: 'files', label: 'All files downloaded' },
                      ]}
                    />
                  </div>

                  {/* Content Layout */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">
                      Content Layout
                    </label>
                    <Select
                      value={contentLayout}
                      onChange={(value) => onContentLayoutChange(value as 'Original' | 'Subfolder' | 'NoSubfolder')}
                      options={[
                        { value: 'Original', label: 'Original' },
                        { value: 'Subfolder', label: 'Subfolder' },
                        { value: 'NoSubfolder', label: 'No Subfolder' },
                      ]}
                    />
                  </div>

                  {/* Tags */}
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-medium text-text-secondary">
                      Tags
                    </label>
                    <div className="rounded-sm border border-border bg-background px-2 py-1 flex flex-wrap items-center gap-1">
                      {selectedTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-sm"
                        >
                          {tag}
                          <button type="button" onClick={() => onRemoveTag(tag)} className="hover:text-primary/70">
                            <X size={ICON_SIZES.sm} />
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        placeholder={selectedTags.length === 0 ? 'tag1, tag2, ...' : ''}
                        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-text-primary placeholder:text-text-muted"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            const value = (e.target as HTMLInputElement).value.trim();
                            if (value && !selectedTags.includes(value)) {
                              onToggleTag(value);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Checkboxes row */}
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={!paused}
                      onChange={(checked) => onPausedChange(!checked)}
                    />
                    <span className="text-sm text-text-primary">Start torrent</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={addToTop}
                      onChange={onAddToTopChange}
                    />
                    <span className="text-sm text-text-primary">Add to top of queue</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={skipChecking}
                      onChange={onSkipCheckingChange}
                    />
                    <span className="text-sm text-text-primary">Skip hash check</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={sequentialDownload}
                      onChange={onSequentialDownloadChange}
                    />
                    <span className="text-sm text-text-primary">Download in sequential order</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={firstLastPiecePrio}
                      onChange={onFirstLastPiecePrioChange}
                    />
                    <span className="text-sm text-text-primary">Download first and last pieces first</span>
                  </label>
                </div>

                {/* Rate Limits */}
                <div className="pt-4 border-t border-border">
                  <span className="mb-3 block text-xs font-medium text-text-secondary">Rate Limits</span>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {/* DL Limit */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Limit download rate
                      </label>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={dlLimit !== null}
                          onChange={(checked) => onDlLimitChange(checked ? 0 : null)}
                        />
                        <div className="min-w-0 flex-1">
                          <NumberInput
                            value={dlLimit ?? 0}
                            unitMode="bytes-per-second"
                            unitDefault="kb"
                            onValueChange={(value) => {
                              onDlLimitChange(value);
                            }}
                            disabled={dlLimit === null}
                            placeholder="0 = unlimited"
                            className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-primary focus-visible:outline-none disabled:text-text-disabled"
                          />
                        </div>
                      </div>
                    </div>

                    {/* UL Limit */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Limit upload rate
                      </label>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={upLimit !== null}
                          onChange={(checked) => onUpLimitChange(checked ? 0 : null)}
                        />
                        <div className="min-w-0 flex-1">
                          <NumberInput
                            value={upLimit ?? 0}
                            unitMode="bytes-per-second"
                            unitDefault="kb"
                            onValueChange={(value) => {
                              onUpLimitChange(value);
                            }}
                            disabled={upLimit === null}
                            placeholder="0 = unlimited"
                            className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-primary focus-visible:outline-none disabled:text-text-disabled"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Footer actions — fixed bottom */}
        <DialogActions
          actions={[
            ...(onCancel
              ? [{ label: 'Cancel', onClick: onCancel, disabled: isSubmitting }]
              : []),
            {
              label: isSubmitting ? 'Adding...' : 'Add Torrent',
              onClick: onSubmit,
              variant: 'primary',
              disabled: isSubmitting,
            },
          ]}
          size="medium"
          stretch={false}
          className="shrink-0 items-center justify-end gap-3 border-t border-border px-4 py-4"
        />
      </div>
    );
  }
);

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-4">
      <span className="text-sm font-medium text-text-primary">{label}</span>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </label>
  );
}

AddTorrentScreenBody.displayName = 'AddTorrentScreenBody';
