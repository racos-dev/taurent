import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAddTorrentScreenController } from '../useAddTorrentScreenController';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderController(options?: Partial<Parameters<typeof useAddTorrentScreenController>[0]>) {
  const addByUrl = vi.fn().mockResolvedValue(undefined);
  const addByFiles = vi.fn().mockResolvedValue(undefined);
  const onSubmitSuccess = vi.fn();
  const onSubmitError = vi.fn();

  const { result } = renderHook(() =>
    useAddTorrentScreenController({
      addByUrl,
      addByFiles,
      mode: options?.mode ?? 'magnet',
      onSubmitSuccess,
      onSubmitError,
      ...options,
    })
  );

  return { result, addByUrl, addByFiles, onSubmitSuccess, onSubmitError };
}

// ─── Source selection ─────────────────────────────────────────────────────────

describe('source selection (desktopUnifiedMode)', () => {
  it('defaults to null lastUsedSource on mount', () => {
    const { result } = renderController({ mode: 'magnet' });
    expect(result.current.lastUsedSource).toBeNull();
  });

  it('setLastUsedSource updates lastUsedSource', () => {
    const { result } = renderController({ mode: 'magnet' });
    act(() => result.current.setLastUsedSource('file'));
    expect(result.current.lastUsedSource).toBe('file');
    act(() => result.current.setLastUsedSource('magnet'));
    expect(result.current.lastUsedSource).toBe('magnet');
  });

  it('effectiveActiveSource returns lastUsedSource when set', () => {
    const { result } = renderController({ mode: 'magnet' });
    act(() => result.current.setLastUsedSource('file'));
    expect(result.current.effectiveActiveSource).toBe('file');
  });

  it('effectiveActiveSource infers magnet when magnetUri is set and no explicit source', () => {
    const { result } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    expect(result.current.effectiveActiveSource).toBe('magnet');
  });

  it('effectiveActiveSource infers file when selectedFiles is set and no explicit source', () => {
    const { result } = renderController({ mode: 'magnet' });
    act(() => result.current.setSelectedFiles(['/path/to/file.torrent']));
    expect(result.current.effectiveActiveSource).toBe('file');
  });
});

// ─── Invalid magnet validation ────────────────────────────────────────────────

describe('validate() — invalid magnet', () => {
  it('returns false and sets error for empty magnet URI', () => {
    const { result } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri(''));
    let valid = true;
    act(() => {
      valid = result.current.validate();
    });
    expect(valid).toBe(false);
    expect(result.current.error).toBe('Please enter a URL or magnet link');
  });

  it('returns false and sets error for invalid magnet format', () => {
    const { result } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri('not-a-magnet'));
    let valid = true;
    act(() => {
      valid = result.current.validate();
    });
    expect(valid).toBe(false);
    expect(result.current.error).toBe('Invalid URL or magnet format');
  });

  it('returns false for http URL without proper scheme', () => {
    const { result } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri('ftp://example.com/file.torrent'));
    let valid = true;
    act(() => {
      valid = result.current.validate();
    });
    expect(valid).toBe(false);
    expect(result.current.error).toBe('Invalid URL or magnet format');
  });

  it('accepts magnet: URI', () => {
    const { result } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc123'));
    let valid = false;
    act(() => {
      valid = result.current.validate();
    });
    expect(valid).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('accepts http:// URL', () => {
    const { result } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri('http://example.com/file.torrent'));
    let valid = false;
    act(() => {
      valid = result.current.validate();
    });
    expect(valid).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('accepts https:// URL', () => {
    const { result } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri('https://example.com/file.torrent'));
    let valid = false;
    act(() => {
      valid = result.current.validate();
    });
    expect(valid).toBe(true);
    expect(result.current.error).toBeNull();
  });
});

// ─── File vs magnet precedence ────────────────────────────────────────────────

describe('file vs magnet precedence (desktopUnifiedMode)', () => {
  it('submits magnet when lastUsedSource is magnet', async () => {
    const { result, addByUrl, addByFiles } = renderController({
      mode: 'magnet',
      desktopUnifiedMode: true,
    });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    act(() => result.current.setSelectedFiles(['/path/to/file.torrent']));
    act(() => result.current.setLastUsedSource('magnet'));
    await act(async () => { await result.current.handleSubmit(); });
    expect(addByUrl).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc', expect.any(Object));
    expect(addByFiles).not.toHaveBeenCalled();
  });

  it('submits file when lastUsedSource is file', async () => {
    const { result, addByUrl, addByFiles } = renderController({
      mode: 'magnet',
      desktopUnifiedMode: true,
    });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    act(() => result.current.setSelectedFiles(['/path/to/file.torrent']));
    act(() => result.current.setLastUsedSource('file'));
    await act(async () => { await result.current.handleSubmit(); });
    expect(addByFiles).toHaveBeenCalledWith(['/path/to/file.torrent'], expect.any(Object));
    expect(addByUrl).not.toHaveBeenCalled();
  });

  it('infers magnet when lastUsedSource is null and only magnetUri is set', async () => {
    const { result, addByUrl, addByFiles } = renderController({
      mode: 'magnet',
      desktopUnifiedMode: true,
    });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    await act(async () => { await result.current.handleSubmit(); });
    expect(addByUrl).toHaveBeenCalled();
    expect(addByFiles).not.toHaveBeenCalled();
  });

  it('infers file when lastUsedSource is null and only selectedFiles is set', async () => {
    const { result, addByUrl, addByFiles } = renderController({
      mode: 'magnet',
      desktopUnifiedMode: true,
    });
    act(() => result.current.setSelectedFiles(['/path/to/file.torrent']));
    await act(async () => { await result.current.handleSubmit(); });
    expect(addByFiles).toHaveBeenCalled();
    expect(addByUrl).not.toHaveBeenCalled();
  });

  it('falls back to magnet when lastUsedSource is null and both sources have data', async () => {
    const { result, addByUrl, addByFiles } = renderController({
      mode: 'magnet',
      desktopUnifiedMode: true,
    });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    act(() => result.current.setSelectedFiles(['/path/to/file.torrent']));
    await act(async () => { await result.current.handleSubmit(); });
    // resolveSubmitSource falls back to magnet when both are present and lastUsedSource is null
    expect(addByUrl).toHaveBeenCalled();
    expect(addByFiles).not.toHaveBeenCalled();
  });

  it('uses mode prop for non-unified mode', async () => {
    const { result, addByUrl, addByFiles } = renderController({
      mode: 'file',
      desktopUnifiedMode: false,
    });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    act(() => result.current.setSelectedFiles(['/path/to/file.torrent']));
    await act(async () => { await result.current.handleSubmit(); });
    expect(addByFiles).toHaveBeenCalled();
    expect(addByUrl).not.toHaveBeenCalled();
  });
});

// ─── Option preservation ──────────────────────────────────────────────────────

describe('option preservation across submit', () => {
  it('preserves savePath across submit', async () => {
    const { result, addByUrl } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    act(() => result.current.setSavePath('/my/path'));
    await act(async () => { await result.current.handleSubmit(); });
    expect(addByUrl).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc', expect.objectContaining({ savepath: '/my/path' }));
  });

  it('preserves category across submit', async () => {
    const { result, addByUrl } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    act(() => result.current.setCategory('videos'));
    await act(async () => { await result.current.handleSubmit(); });
    expect(addByUrl).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc', expect.objectContaining({ category: 'videos' }));
  });

  it('preserves tags across submit', async () => {
    const { result, addByUrl } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    act(() => result.current.setSelectedTags(['tag1', 'tag2']));
    await act(async () => { await result.current.handleSubmit(); });
    expect(addByUrl).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc', expect.objectContaining({ tags: 'tag1,tag2' }));
  });

  it('preserves sequentialDownload across submit', async () => {
    const { result, addByUrl } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    act(() => result.current.setSequentialDownload(true));
    await act(async () => { await result.current.handleSubmit(); });
    expect(addByUrl).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc', expect.objectContaining({ sequential_download: true }));
  });

  it('preserves skipChecking across submit', async () => {
    const { result, addByUrl } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    act(() => result.current.setSkipChecking(true));
    await act(async () => { await result.current.handleSubmit(); });
    expect(addByUrl).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc', expect.objectContaining({ skip_checking: true }));
  });

  it('preserves paused across submit', async () => {
    const { result, addByUrl } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    act(() => result.current.setPaused(true));
    await act(async () => { await result.current.handleSubmit(); });
    expect(addByUrl).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc', expect.objectContaining({ paused: true }));
  });

  it('preserves rootFolder across submit', async () => {
    const { result, addByUrl } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    act(() => result.current.setRootFolder(false));
    await act(async () => { await result.current.handleSubmit(); });
    expect(addByUrl).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc', expect.objectContaining({ root_folder: false }));
  });

  it('preserves rename across submit', async () => {
    const { result, addByUrl } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    act(() => result.current.setRename('my-torrent'));
    await act(async () => { await result.current.handleSubmit(); });
    expect(addByUrl).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc', expect.objectContaining({ rename: 'my-torrent' }));
  });

  it('preserves upLimit across submit', async () => {
    const { result, addByUrl } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    act(() => result.current.setUpLimit(500));
    await act(async () => { await result.current.handleSubmit(); });
    expect(addByUrl).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc', expect.objectContaining({ up_limit: 500 }));
  });

  it('preserves dlLimit across submit', async () => {
    const { result, addByUrl } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    act(() => result.current.setDlLimit(1000));
    await act(async () => { await result.current.handleSubmit(); });
    expect(addByUrl).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc', expect.objectContaining({ dl_limit: 1000 }));
  });

  it('preserves autoTMM across submit', async () => {
    const { result, addByUrl } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    act(() => result.current.setAutoTMM(true));
    await act(async () => { await result.current.handleSubmit(); });
    expect(addByUrl).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc', expect.objectContaining({ auto_tmm: true }));
  });

  it('preserves firstLastPiecePrio across submit', async () => {
    const { result, addByUrl } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    act(() => result.current.setFirstLastPiecePrio(true));
    await act(async () => { await result.current.handleSubmit(); });
    expect(addByUrl).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc', expect.objectContaining({ first_last_piece_prio: true }));
  });

  it('preserves contentLayout across submit', async () => {
    const { result, addByUrl } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    act(() => result.current.setContentLayout('NoSubfolder'));
    await act(async () => { await result.current.handleSubmit(); });
    expect(addByUrl).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc', expect.objectContaining({ content_layout: 'NoSubfolder' }));
  });

  it('preserves stopCondition across submit', async () => {
    const { result, addByUrl } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    act(() => result.current.setStopCondition('metadata'));
    await act(async () => { await result.current.handleSubmit(); });
    expect(addByUrl).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc', expect.objectContaining({ stop_condition: 'metadata' }));
  });

  it('preserves addToTop across submit', async () => {
    const { result, addByUrl } = renderController({ mode: 'magnet' });
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    act(() => result.current.setAddToTop(true));
    await act(async () => { await result.current.handleSubmit(); });
    expect(addByUrl).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc', expect.objectContaining({ add_to_top: true }));
  });
});

// ─── Failed submit preserving entered state ────────────────────────────────────

describe('failed submit — state preservation', () => {
  it('preserves magnetUri after failed submit', async () => {
    const { result, addByUrl } = renderController({ mode: 'magnet' });
    addByUrl.mockRejectedValueOnce(new Error('network error'));
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    await act(async () => { await result.current.handleSubmit(); });
    expect(result.current.magnetUri).toBe('magnet:?xt=urn:btih:abc');
  });

  it('preserves selectedFiles after failed submit', async () => {
    const { result, addByFiles } = renderController({ mode: 'file' });
    addByFiles.mockRejectedValueOnce(new Error('network error'));
    act(() => result.current.setSelectedFiles(['/path/to/file.torrent']));
    await act(async () => { await result.current.handleSubmit(); });
    expect(result.current.selectedFiles).toEqual(['/path/to/file.torrent']);
  });

  it('preserves all options after failed submit', async () => {
    const { result, addByUrl } = renderController({ mode: 'magnet' });
    addByUrl.mockRejectedValueOnce(new Error('network error'));
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    act(() => result.current.setSavePath('/dl'));
    act(() => result.current.setCategory('video'));
    act(() => result.current.setSelectedTags(['tag1']));
    act(() => result.current.setSequentialDownload(true));
    act(() => result.current.setSkipChecking(true));
    act(() => result.current.setPaused(true));
    act(() => result.current.setRootFolder(false));
    act(() => result.current.setRename('my-file'));
    act(() => result.current.setUpLimit(100));
    act(() => result.current.setDlLimit(200));
    act(() => result.current.setAutoTMM(true));
    act(() => result.current.setFirstLastPiecePrio(true));
    act(() => result.current.setContentLayout('NoSubfolder'));
    act(() => result.current.setStopCondition('metadata'));
    act(() => result.current.setAddToTop(true));
    await act(async () => { await result.current.handleSubmit(); });

    expect(result.current.savePath).toBe('/dl');
    expect(result.current.category).toBe('video');
    expect(result.current.selectedTags).toEqual(['tag1']);
    expect(result.current.sequentialDownload).toBe(true);
    expect(result.current.skipChecking).toBe(true);
    expect(result.current.paused).toBe(true);
    expect(result.current.rootFolder).toBe(false);
    expect(result.current.rename).toBe('my-file');
    expect(result.current.upLimit).toBe(100);
    expect(result.current.dlLimit).toBe(200);
    expect(result.current.autoTMM).toBe(true);
    expect(result.current.firstLastPiecePrio).toBe(true);
    expect(result.current.contentLayout).toBe('NoSubfolder');
    expect(result.current.stopCondition).toBe('metadata');
    expect(result.current.addToTop).toBe(true);
  });

  it('sets error after failed submit', async () => {
    const { result, addByUrl, onSubmitError } = renderController({ mode: 'magnet' });
    addByUrl.mockRejectedValueOnce(new Error('server error'));
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    await act(async () => { await result.current.handleSubmit(); });
    expect(result.current.error).toBe('Could not add the torrent. Try again.');
    expect(onSubmitError).toHaveBeenCalledWith('Could not add the torrent. Try again.');
  });

  it('resets isSubmitting after failed submit', async () => {
    const { result, addByUrl } = renderController({ mode: 'magnet' });
    addByUrl.mockRejectedValueOnce(new Error('server error'));
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    await act(async () => { await result.current.handleSubmit(); });
    expect(result.current.isSubmitting).toBe(false);
  });

  it('clears error when validate is called after failed submit', async () => {
    const { result, addByUrl } = renderController({ mode: 'magnet' });
    addByUrl.mockRejectedValueOnce(new Error('server error'));
    act(() => result.current.setMagnetUri('magnet:?xt=urn:btih:abc'));
    await act(async () => { await result.current.handleSubmit(); });
    expect(result.current.error).toBe('Could not add the torrent. Try again.');
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});
