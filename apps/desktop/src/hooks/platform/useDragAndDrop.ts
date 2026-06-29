import { useState, useEffect } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import type { DragDropEvent } from '@tauri-apps/api/webview';
import type { Event } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';

interface UseWindowDragAndDropOptions {
  acceptedTypes?: string[];
  onDrop: (files: string[]) => void;
}

export function useWindowDragAndDrop({
  acceptedTypes = ['.torrent'],
  onDrop,
}: UseWindowDragAndDropOptions): { isDragging: boolean } {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setup = async () => {
      const webview = getCurrentWebview();
      unlisten = await webview.onDragDropEvent((event: Event<DragDropEvent>) => {
        switch (event.payload.type) {
          case 'enter':
          case 'over':
            setIsDragging(true);
            break;
          case 'leave':
            setIsDragging(false);
            break;
          case 'drop':
            setIsDragging(false);
            if (event.payload.paths) {
              const filtered = event.payload.paths.filter((path: string) =>
                acceptedTypes.some((type) => path.toLowerCase().endsWith(type.toLowerCase())),
              );
              if (filtered.length > 0) {
                onDrop(filtered);
              }
            }
            break;
        }
      });
    };

    setup();

    return () => {
      unlisten?.();
    };
  }, [onDrop, acceptedTypes]);

  return { isDragging };
}
